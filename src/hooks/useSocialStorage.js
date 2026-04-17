// useSocialStorage.js — Persistent social links hook
import { useState, useEffect } from 'react';

const ENV_DEFAULTS = {
  tiktok:   import.meta.env.VITE_SOCIAL_TIKTOK    || '',
  youtube:  import.meta.env.VITE_SOCIAL_YOUTUBE   || '',
  linkedin: import.meta.env.VITE_SOCIAL_LINKEDIN  || '',
  ig:       import.meta.env.VITE_SOCIAL_INSTAGRAM || '',
  fb:       import.meta.env.VITE_SOCIAL_FACEBOOK  || '',
  x:        import.meta.env.VITE_SOCIAL_X         || '',
  reddit:   import.meta.env.VITE_SOCIAL_REDDIT    || '',
};

export function useSocialStorage() {
  const [links, setLinks] = useState(() => {
    try {
      const saved = localStorage.getItem('winlab_social_links');
      const stored = saved ? JSON.parse(saved) : {};
      // env vars come default; localStorage sovrascrive solo se l'admin ha salvato
      return { ...ENV_DEFAULTS, ...stored };
    } catch {
      return { ...ENV_DEFAULTS };
    }
  });

  useEffect(() => {
    localStorage.setItem('winlab_social_links', JSON.stringify(links));
  }, [links]);

  const updateLink = (name, value) => {
    setLinks(prev => ({ ...prev, [name]: value }));
  };

  const hasAnyLink = Object.values(links).some(v => v && v.trim() !== '');

  return [links, setLinks, updateLink, hasAnyLink];
}
