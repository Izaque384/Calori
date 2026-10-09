import Link from "next/link";
import CaloriBrand from "@/components/calori-brand";

const journey = [
  { number: "01", title: "Escaneia", text: "O cliente abre a mesa pelo QR Code, sem app e sem cadastro." },
  { number: "02", title: "Escolhe", text: "Vê o cardápio, personaliza itens e monta o pedido no próprio celular." },
  { number: "03", title: "Pede", text: "O pedido entra direto na operação e a equipe acompanha o andamento." },
  { number: "04", title: "Acompanha", text: "O cliente sabe se foi recebido, está em preparo ou já está pronto." },
  { number: "05", title: "Chama e fecha", text: "Atendimento, observações e conta ficam ligados à mesa certa." },
];

export default function Home() {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link href="/" aria-label="Calori — início"><CaloriBrand compact /></Link>
        <nav className="landing-nav" aria-label="Navegação principal">
          <a href="#fluxo">Como funciona</a><a href="#operacao">Operação</a><a href="#preco">Preço</a>
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-login" href="/auth/sign-in">Entrar</Link>
          <Link className="primary-button landing-header-cta" href="/auth/sign-up">Começar grátis</Link>
        </div>
      </header>

      <section className="landing-hero landing-hero-operations">
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <span className="landing-pill">A operação da mesa no celular</span>
          <h1>Da mesa para a cozinha, sem levantar a mão.</h1>
          <p>Seu cliente vê o cardápio, faz o pedido, acompanha o preparo, chama atendimento e pede a conta. Sua equipe recebe tudo organizado por mesa.</p>
          <div className="landing-hero-actions">
            <Link className="landing-primary-cta" href="/auth/sign-up">Começar 14 dias grátis <span aria-hidden="true">→</span></Link>
            <span>Sem cartão · depois R$ 59/mês</span>
          </div>
        </div>
        <div className="landing-feature-strip">
          <article><span className="landing-feature-number">01</span><div><small>Cliente</small><strong>Cardápio e pedido</strong></div></article>
          <article><span className="landing-feature-number">02</span><div><small>Equipe</small><strong>Pedidos em tempo real</strong></div></article>
          <article><span className="landing-feature-number">03</span><div><small>Salão</small><strong>Chamados por mesa</strong></div></article>
          <article><span className="landing-feature-number">04</span><div><small>Gestão</small><strong>Operação em um olhar</strong></div></article>
        </div>
      </section>

      <section className="landing-flow" id="fluxo">
        <div className="landing-flow-heading">
          <span className="section-kicker">Uma jornada, não vários sistemas</span>
          <h2>Do primeiro toque à conta.</h2>
          <p>O Calori acompanha a experiência inteira da mesa e mantém o restaurante no controle.</p>
        </div>
        <div className="landing-flow-grid">
          {journey.map((step) => <article key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}
        </div>
      </section>

      <section className="landing-editorial" id="operacao">
        <img className="landing-editorial-photo" src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=88" alt="Mesa de restaurante preparada para receber clientes" loading="lazy" />
        <div className="landing-editorial-copy">
          <span className="section-kicker">O salão continua humano</span>
          <h2>Menos tempo procurando o garçom. Mais tempo atendendo bem.</h2>
          <p>A tecnologia cuida das tarefas repetitivas e entrega contexto para a equipe: qual mesa chamou, há quanto tempo espera, qual pedido está pronto e quem pediu a conta.</p>
          <div className="landing-benefit-list">
            <div><span /><div><strong>Mapa vivo do salão</strong><p>Mesas, pedidos e prioridades aparecem em uma visão operacional.</p></div></div>
            <div><span /><div><strong>Atendimento com contexto</strong><p>O cliente pode explicar o que precisa antes da equipe chegar à mesa.</p></div></div>
            <div><span /><div><strong>Pedido acompanhado</strong><p>Menos perguntas sobre andamento e uma experiência mais previsível.</p></div></div>
          </div>
        </div>
      </section>

      <section className="landing-showcase">
        <div className="landing-showcase-copy">
          <span className="landing-pill light">Experiência da mesa</span>
          <h2>Quatro ações que o cliente entende de imediato.</h2>
          <p>Cardápio, Meu pedido, Atendimento e Minha conta ficam sempre acessíveis durante a visita.</p>
          <Link href="/auth/sign-up">Configurar meu restaurante <span aria-hidden="true">→</span></Link>
        </div>
        <div className="landing-table-journey" aria-hidden="true">
          <div><span>01</span><strong>Cardápio</strong><small>Escolher e personalizar</small></div>
          <div><span>02</span><strong>Meu pedido</strong><small>Acompanhar preparo</small></div>
          <div><span>03</span><strong>Atendimento</strong><small>Chamar com observação</small></div>
          <div><span>04</span><strong>Minha conta</strong><small>Ver total e solicitar</small></div>
        </div>
      </section>

      <section className="landing-pricing" id="preco">
        <div><span className="section-kicker">Plano único</span><h2>R$ 59<small>/mês</small></h2><p>Cardápio, pedidos, mesas, atendimento, equipe e relatórios. Um restaurante.</p></div>
        <div className="landing-pricing-side"><strong>14 dias grátis</strong><span>Sem cartão no início.</span><Link className="landing-primary-cta" href="/auth/sign-up">Começar agora <span aria-hidden="true">→</span></Link></div>
      </section>

      <footer className="landing-footer"><CaloriBrand compact /><p>A operação da mesa, organizada.</p><span>© 2026 Calori</span></footer>
    </main>
  );
}
