export const tasks = {
  chat: 'Диалоги',
  code: 'Код',
  reasoning: 'Рассуждения',
  vision: 'Изображения',
  embedding: 'Поиск',
};

export const models = [
  {
    id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5 7B Instruct', creator: 'Qwen', task: 'chat', contextTokens: 131072,
    description: 'Инструкционная языковая модель для диалогов, работы с текстом и структурированными данными.',
    tags: ['Текст', 'Мультиязычность', 'JSON'], source: 'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct', license: 'Apache 2.0',
  },
  {
    id: 'Qwen/Qwen2.5-Coder-7B-Instruct', name: 'Qwen2.5 Coder 7B Instruct', creator: 'Qwen', task: 'code', contextTokens: 131072,
    description: 'Инструкционная модель для генерации, анализа и исправления кода.',
    tags: ['Код', 'Текст'], source: 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct', license: 'Apache 2.0',
  },
  {
    id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', name: 'DeepSeek R1 Distill Qwen 7B', creator: 'DeepSeek', task: 'reasoning', contextTokens: 131072,
    description: 'Модель на основе Qwen, дообученная на данных рассуждений DeepSeek R1.',
    tags: ['Рассуждения', 'Математика', 'Код'], source: 'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', license: 'MIT',
  },
  {
    id: 'Qwen/Qwen2.5-VL-7B-Instruct', name: 'Qwen2.5 VL 7B Instruct', creator: 'Qwen', task: 'vision', contextTokens: 128000,
    description: 'Мультимодальная модель для работы с изображениями, текстом и видео.',
    tags: ['Изображения', 'Документы', 'Видео'], source: 'https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct', license: 'Apache 2.0',
  },
  {
    id: 'nomic-ai/nomic-embed-text-v1.5', name: 'Nomic Embed Text v1.5', creator: 'Nomic AI', task: 'embedding', contextTokens: 8192,
    description: 'Модель текстовых embeddings для семантического поиска и сопоставления текстов.',
    tags: ['Embeddings', 'Семантический поиск'], source: 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5', license: 'Apache 2.0',
  },
  {
    id: 'Qwen/Qwen2.5-Coder-3B-Instruct', name: 'Qwen2.5 Coder 3B Instruct', creator: 'Qwen', task: 'code', contextTokens: 32768,
    description: 'Инструкционная модель семейства Qwen2.5 Coder для работы с кодом.',
    tags: ['Код', 'Текст'], source: 'https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct', license: 'Qwen Research License',
  },
];

export function getModel(id) {
  return models.find((model) => model.id === id);
}
