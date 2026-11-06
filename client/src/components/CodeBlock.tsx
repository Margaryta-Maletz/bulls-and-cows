import { useEffect, useRef } from 'react';

interface Props {
  readonly children: string;
}

export default function CodeBlock({ children }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && window.hljs) {
      delete el.dataset['highlighted'];
      window.hljs.highlightElement(el);
    }
  }, [children]);

  return (
    <pre>
      <code ref={ref} className="language-javascript">{children}</code>
    </pre>
  );
}
