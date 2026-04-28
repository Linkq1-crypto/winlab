import { useState, useEffect } from 'react';

const TYPE_COLOR = {
  system:  'text-red-400 font-bold',
  warning: 'text-yellow-400',
  info:    'text-blue-400',
  success: 'text-green-400',
  error:   'text-red-500 font-bold',
  prompt:  'text-gray-400',
};

export default function LabBootSplash({ bootSequence, onReady }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [allVisible, setAllVisible] = useState(false);

  useEffect(() => {
    if (visibleCount < bootSequence.length) {
      const t = setTimeout(() => setVisibleCount(v => v + 1), 150);
      return () => clearTimeout(t);
    } else {
      setAllVisible(true);
    }
  }, [visibleCount, bootSequence.length]);

  useEffect(() => {
    if (!allVisible) return;
    const onKey = () => onReady();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allVisible, onReady]);

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col justify-center px-12 py-16 font-mono cursor-pointer"
      onClick={allVisible ? onReady : undefined}
    >
      <div className="text-gray-700 text-[10px] tracking-[0.3em] uppercase mb-10">
        WINLAB · INCIDENT ROUTER · v4.2.0
      </div>
      <div className="space-y-2 max-w-2xl">
        {bootSequence.slice(0, visibleCount).map((line, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed ${TYPE_COLOR[line.type] ?? 'text-gray-400'}`}
          >
            {line.text}
          </div>
        ))}
      </div>
      {allVisible && (
        <div className="mt-12 text-gray-600 text-xs animate-pulse">
          [ press any key to enter ]
        </div>
      )}
    </div>
  );
}
