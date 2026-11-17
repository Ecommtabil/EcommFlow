'use client';

/** Botão de envio que pede confirmação antes (ex.: exclusões). */
export function BotaoConfirmar({ mensagem, children, className = 'btn sm gh', title }: { mensagem: string; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <button className={className} title={title} onClick={(e) => { if (!window.confirm(mensagem)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
