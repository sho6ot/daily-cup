const limits = { requestsPerDay: [1n, 1000000n], inputTokens: [0n, 10000000n], outputTokens: [0n, 10000000n], days: [1n, 31n] };
const labels = { requestsPerDay: 'Запросы в день', inputTokens: 'Входные токены', outputTokens: 'Выходные токены', days: 'Дни работы' };

export function estimateUsage(values) {
  const parsed = {}, fields = {};
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = String(values[key] ?? '').trim();
    if (!/^\d+$/.test(value) || value.length > 12) { fields[key] = 'Укажите целое неотрицательное число.'; continue; }
    parsed[key] = BigInt(value);
    if (parsed[key] < min || parsed[key] > max) fields[key] = `${labels[key]}: допустимо от ${min} до ${max}.`;
  }
  if (!Object.keys(fields).length && parsed.inputTokens + parsed.outputTokens === 0n) fields.inputTokens = 'Укажите ненулевой объём входных или выходных токенов.';
  if (Object.keys(fields).length) { const error = new Error('Проверьте параметры нагрузки.'); error.fields = fields; throw error; }
  const requests = parsed.requestsPerDay * parsed.days;
  const input = requests * parsed.inputTokens;
  const output = requests * parsed.outputTokens;
  return { requests: requests.toString(), input: input.toString(), output: output.toString(), total: (input + output).toString() };
}

export function formatTokens(value) {
  return new Intl.NumberFormat('ru-RU').format(BigInt(value));
}
