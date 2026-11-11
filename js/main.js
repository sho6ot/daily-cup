(() => {
  'use strict';

  document.documentElement.classList.add('js');
  const cafes = window.DAILY_CUP;
  const labels = { taste: 'Вкус', barista: 'Бариста', atmosphere: 'Атмосфера', value: 'Цена' };
  const keys = { review: 'daily-cup.reviews.v1', suggest: 'daily-cup.suggestions.v1' };
  const photoAlts = [
    'Интерьер современной кофейни со столами и стульями',
    'Интерьер кофейни с тёплым освещением',
    'Солнечный свет в интерьере современной кофейни',
    'Интерьер кофейни с кирпичной стеной',
    'Уютная кофейня с меню над стойкой',
    'Уютный стильный интерьер кафе'
  ];
  const average = scores => (Object.values(scores).reduce((sum, score) => sum + score, 0) / 4)
    .toFixed(2).replace('.', ',');

  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('site-nav');
  const setMenu = open => {
    menuButton.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  };
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuButton.focus();
    }
  });

  const filterForm = document.getElementById('filter-form');
  if (filterForm) {
    const filters = ['district', 'price', 'method'];
    const params = new URLSearchParams(location.search);
    filters.forEach(name => {
      const control = filterForm.elements[name];
      const value = params.get(name);
      if (Array.from(control.options).some(option => option.value === value)) control.value = value;
    });
    const applyFilters = () => {
      let count = 0;
      const district = filterForm.elements.district.value;
      const price = Number(filterForm.elements.price.value) || Infinity;
      const method = filterForm.elements.method.value;
      document.querySelectorAll('#catalog-grid .cafe-card').forEach(card => {
        const visible = (!district || card.dataset.district === district)
          && Number(card.dataset.price) <= price
          && (!method || card.dataset.methods.split(',').includes(method));
        card.hidden = !visible;
        if (visible) count += 1;
      });
      document.getElementById('result-count').textContent = `Найдено: ${count}`;
      document.getElementById('empty-state').hidden = count !== 0;
      const url = new URL(location.href);
      filters.forEach(name => {
        const value = filterForm.elements[name].value;
        if (value) url.searchParams.set(name, value);
        else url.searchParams.delete(name);
      });
      history.replaceState(null, '', url);
    };
    filterForm.addEventListener('change', applyFilters);
    filterForm.addEventListener('submit', event => event.preventDefault());
    filterForm.addEventListener('reset', () => queueMicrotask(applyFilters));
    document.getElementById('clear-filters').addEventListener('click', () => {
      filterForm.reset();
      document.getElementById('results-title').setAttribute('tabindex', '-1');
      document.getElementById('results-title').focus();
    });
    applyFilters();

    const toggle = document.querySelector('.filter-toggle');
    const body = document.getElementById('filter-body');
    const desktop = matchMedia('(min-width: 64rem)');
    const setFiltersOpen = open => {
      body.classList.toggle('is-collapsed', !open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    setFiltersOpen(desktop.matches);
    desktop.addEventListener('change', () => setFiltersOpen(desktop.matches));
    toggle.addEventListener('click', () => setFiltersOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  }

  // Не вставляем пользовательские строки через innerHTML.
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const readRecords = kind => {
    const records = JSON.parse(localStorage.getItem(keys[kind]) || '[]');
    if (!Array.isArray(records)) throw new Error('Invalid local records');
    return records;
  };
  const writeRecords = (kind, records) => localStorage.setItem(keys[kind], JSON.stringify(records));
  const validRecord = record => record && typeof record.id === 'string'
    && typeof record.name === 'string' && typeof record.text === 'string';
  const validReview = record => validRecord(record) && cafes.some(cafe => cafe.id === record.cafe)
    && record.scores && Object.keys(labels).every(key => Number.isInteger(record.scores[key])
      && record.scores[key] >= 1 && record.scores[key] <= 5);

  const reviewNode = (record, club = false) => {
    const article = element('article', 'review');
    const meta = element('div', 'review__meta');
    meta.append(element('h3', '', record.name), element('span', 'rating', `★ ${average(record.scores)} / 5`));
    article.append(meta);
    const scores = element('p', 'review__scores');
    Object.entries(labels).forEach(([key, label]) => scores.append(element('span', '', `${label}: ${record.scores[key]}/5`)));
    article.append(scores, element('p', 'review__text', record.text));
    if (!club) article.append(element('p', 'field__hint', 'Ваш отзыв · сохранён только в этом браузере'));
    return article;
  };

  const cafeContent = document.getElementById('cafe-content');
  if (cafeContent) {
    const id = new URLSearchParams(location.search).get('id') || cafes[0].id;
    const cafe = cafes.find(item => item.id === id);
    if (!cafe) {
      cafeContent.remove();
      const notFound = document.getElementById('cafe-not-found');
      notFound.hidden = false;
      const heading = element('h1', '', 'Не нашли эту кофейню');
      notFound.querySelector('h1, h2').replaceWith(heading);
      document.title = 'Кофейня не найдена · Daily Cup';
    } else {
      const index = cafes.indexOf(cafe);
      document.title = `${cafe.name} · Daily Cup`;
      const values = {
        'cafe-name': cafe.name, 'cafe-district': `${cafe.district} · Москва`,
        'cafe-tagline': cafe.tagline, 'cafe-description': cafe.description,
        'cafe-area': cafe.district, 'cafe-address': cafe.address,
        'cafe-price': `${cafe.price} ₽`, 'cafe-hours': cafe.hours,
        'cafe-rating': `★ ${average(cafe.scores)} из 5 · оценка клуба`
      };
      Object.entries(values).forEach(([key, value]) => { document.getElementById(key).textContent = value; });
      const picture = document.querySelector('#cafe-photo picture');
      const image = picture.querySelector('img');
      const source = picture.querySelector('source');
      const imageSet = format => [480, 960, 1440].map(width => `images/${cafe.image}-${width}.${format} ${width}w`).join(', ');
      source.srcset = imageSet('webp');
      image.srcset = imageSet('jpg');
      image.src = `images/${cafe.image}-960.jpg`;
      image.alt = photoAlts[index];
      ['methods', 'features'].forEach(key => {
        const list = document.getElementById(`cafe-${key}`);
        list.replaceChildren(...cafe[key].map(text => element('li', key === 'methods' ? 'tag' : '', text)));
      });
      Object.keys(labels).forEach(key => { document.getElementById(`score-${key}`).textContent = `${cafe.scores[key]} / 5`; });
      document.getElementById('review-link').href = `order.html?cafe=${cafe.id}#review`;
      const reviews = document.getElementById('cafe-reviews');
      reviews.append(reviewNode({ ...cafe.review, scores: cafe.scores }, true));
      try {
        readRecords('review').filter(validReview).filter(record => record.cafe === cafe.id)
          .reverse().forEach(record => reviews.append(reviewNode(record)));
      } catch {
        document.getElementById('review-storage-note').textContent = 'Не удалось прочитать локальные отзывы. Возможно, хранение данных запрещено в браузере.';
      }

      const gallery = document.getElementById('cafe-gallery');
      const dialog = document.getElementById('photo-dialog');
      const button = element('button', 'button button--secondary', 'Увеличить фото ↗');
      button.type = 'button';
      button.addEventListener('click', () => {
        const photo = document.getElementById('dialog-photo');
        photo.src = `images/${cafe.image}-1440.jpg`;
        photo.alt = photoAlts[index];
        document.getElementById('photo-title').textContent = `${cafe.name} · иллюстрация`;
        dialog.showModal();
      });
      gallery.append(button);
      dialog.querySelector('.dialog__close').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    }
  }

  const savedList = document.getElementById('saved-list');
  const renderSaved = () => {
    if (!savedList) return;
    savedList.replaceChildren();
    let count = 0;
    Object.keys(keys).forEach(kind => {
      readRecords(kind).filter(kind === 'review' ? validReview : validRecord).forEach(record => {
        count += 1;
        const item = element('article', 'saved-item');
        const cafe = cafes.find(cafe => cafe.id === record.cafe);
        item.append(element('h3', '', kind === 'review' ? `Отзыв: ${cafe.name}` : `Предложение: ${record.title}`));
        item.append(element('p', 'muted', record.name), element('p', '', record.text));
        if (kind === 'review') {
          item.append(element('p', 'review__scores', Object.entries(labels)
            .map(([key, title]) => `${title}: ${record.scores[key]}/5`).join(' · ')));
          const link = element('a', '', 'Посмотреть на странице кофейни');
          link.href = `product.html?id=${cafe.id}#reviews-title`;
          item.append(link);
        } else {
          item.append(element('p', 'muted', `${record.district}, ${record.address} · ${record.price} ₽ · ${record.method}`));
        }
        const remove = element('button', 'button button--small button--secondary', 'Удалить');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Удалить ${kind === 'review' ? 'отзыв' : 'предложение'}: ${cafe?.name || record.title}`);
        remove.addEventListener('click', () => {
          try {
            writeRecords(kind, readRecords(kind).filter(item => item.id !== record.id));
            renderSaved();
            const title = document.getElementById('saved-title');
            title.tabIndex = -1;
            title.focus();
          } catch {
            const notice = document.getElementById('saved-empty');
            notice.hidden = false;
            notice.textContent = 'Не удалось удалить запись. Проверьте разрешения браузера на хранение данных.';
          }
        });
        const actions = element('div', 'form__actions');
        actions.append(remove);
        item.append(actions);
        savedList.append(item);
      });
    });
    document.getElementById('saved-empty').hidden = count !== 0;
  };

  if (savedList) {
    const cafeSelect = document.getElementById('review-cafe');
    const cafeId = new URLSearchParams(location.search).get('cafe');
    if (cafes.some(cafe => cafe.id === cafeId)) cafeSelect.value = cafeId;
    try { renderSaved(); } catch {
      document.getElementById('saved-empty').textContent = 'Локальные записи недоступны. Разрешите хранение данных для этого сайта.';
    }

    ['review', 'suggest'].forEach(kind => {
      const form = document.getElementById(`${kind}-form`);
      const status = document.getElementById(`${kind}-status`);
      const controls = Array.from(form.querySelectorAll('input, select, textarea'));
      const mark = control => {
        control.setCustomValidity('');
        if ((control.type === 'text' || control.tagName === 'TEXTAREA')
          && control.value.trim().length < Math.max(control.required ? 1 : 0, control.minLength)) {
          control.setCustomValidity(`Введите не менее ${Math.max(1, control.minLength)} символов, не считая пробелов по краям.`);
        }
        const error = document.getElementById(`${control.id}-error`);
        if (control.validity.valid) {
          control.removeAttribute('aria-invalid');
          error.textContent = '';
        } else {
          control.setAttribute('aria-invalid', 'true');
          error.textContent = control.validationMessage;
        }
      };
      form.addEventListener('input', event => {
        if (event.target.hasAttribute('aria-invalid')) mark(event.target);
      });
      form.addEventListener('change', event => {
        if (event.target.hasAttribute('aria-invalid')) mark(event.target);
      });
      form.addEventListener('reset', () => {
        controls.forEach(control => {
          control.setCustomValidity('');
          control.removeAttribute('aria-invalid');
          document.getElementById(`${control.id}-error`).textContent = '';
        });
        status.hidden = true;
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        status.hidden = true;
        controls.forEach(control => {
          if (control.type === 'text' || control.tagName === 'TEXTAREA') control.value = control.value.trim();
          mark(control);
        });
        if (!form.checkValidity()) {
          form.querySelector('[aria-invalid="true"]').focus();
          return;
        }
        const data = new FormData(form);
        const value = name => data.get(`${kind}-${name}`);
        const record = {
          id: crypto.randomUUID(), name: value(kind === 'review' ? 'name' : 'author'),
          text: value('comment')
        };
        if (kind === 'review') {
          record.cafe = value('cafe');
          record.scores = Object.fromEntries(Object.keys(labels).map(key => [key, Number(value(key))]));
        } else {
          Object.assign(record, {
            title: value('name'), district: value('district'), address: value('address'),
            price: Number(value('price')), method: value('method')
          });
        }
        try {
          const records = readRecords(kind);
          records.push(record);
          writeRecords(kind, records);
        } catch {
          status.className = 'notice notice--error';
          status.textContent = 'Запись не сохранена. Проверьте, разрешено ли хранение данных сайта и достаточно ли места в браузере.';
          status.hidden = false;
          status.focus();
          return;
        }
        form.reset();
        renderSaved();
        status.className = 'notice notice--success';
        status.textContent = kind === 'review'
          ? 'Отзыв сохранён в этом браузере. Он доступен на странице кофейни и в блокноте ниже.'
          : 'Предложение сохранено в этом браузере. Оно доступно в блокноте ниже и не отправлено на сервер.';
        status.hidden = false;
        status.focus();
      });
    });
  }
  // Плавное появление блоков при прокрутке. Без JS и с reduced-motion всё видно сразу.
  const revealTargets = document.querySelectorAll('.section, .cafe-card, .stats__item, .steps__item, .banner, .page-heading, .review, .saved-item');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealTargets.forEach(node => node.classList.add('reveal'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    revealTargets.forEach(node => observer.observe(node));
  }
})();
