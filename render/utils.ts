export const log = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
  const prefixes = {
    error: '❌',
    info: '📝',
    success: '✅',
    warn: '⚠️',
  };
  console.log(`${prefixes[type]} ${message}`);
};

export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
