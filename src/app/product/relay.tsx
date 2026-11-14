import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Leaf,
  Users,
  Workflow,
} from "lucide-react";
import AgentScene from "./scene";
import styles from "./product.module.css";

export default function Relay() {
  return (
    <main className={styles.page} lang="en">
      <section className={styles.hero}>
        <Image
          className={styles.backdrop}
          src="/brand/relay-interior.png"
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <header className={styles.nav}>
          <Link className={styles.brand} href="/product">
            <Leaf aria-hidden="true" />
            Booking Lab
          </Link>
          <nav aria-label="Product navigation">
            <a href="#product">Product</a>
            <a href="#agents">Agent-ready</a>
            <Link href="/admin/overview">
              Log in <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </nav>
        </header>
        <div className={styles.heroBody}>
          <h1>
            Your next booking.
            <br />
            Just ask.
          </h1>
          <p>Agent-ready booking. Built around your business.</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#agent-demo">
              See it in action <ArrowUpRight size={19} aria-hidden="true" />
            </a>
            <Link className={styles.textLink} href="/admin/overview">
              Explore the workspace
            </Link>
          </div>
          <AgentScene />
        </div>
      </section>
      <section
        className={styles.section}
        id="product"
        aria-labelledby="product-heading"
      >
        <p className={styles.eyebrow}>One connected day</p>
        <h2 id="product-heading">More than a time slot.</h2>
        <p className={styles.lead}>
          The people, the appointments, the changes in between. Keep them
          together.
        </p>
        <div className={styles.features}>
          <Link href="/">
            <CalendarDays aria-hidden="true" />
            <h3>A simpler way to book</h3>
            <p>
              Choose a treatment, a person and a time. Know exactly what you are
              confirming.
            </p>
            <span>
              Try customer booking <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </Link>
          <Link href="/admin">
            <Workflow aria-hidden="true" />
            <h3>A calmer working day</h3>
            <p>See who is coming. Move a visit. Make room when plans change.</p>
            <span>
              Explore the calendar <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </Link>
          <Link href="/admin/customers">
            <Users aria-hidden="true" />
            <h3>Keep the context</h3>
            <p>
              Find a customer, see their visits and book the next one without
              starting over.
            </p>
            <span>
              Open customer records{" "}
              <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>
      <section
        className={`${styles.section} ${styles.agentSection}`}
        id="agents"
        aria-labelledby="agent-heading"
      >
        <div>
          <p className={styles.eyebrow}>
            Built for people and their assistants
          </p>
          <h2 id="agent-heading">
            Your assistant.
            <br />
            Your rules.
          </h2>
        </div>
        <div>
          <p className={styles.lead}>
            Ask naturally. Review the choices. Confirm what happens next.
          </p>
          <p>
            Our local MCP demos connect assistants to the same availability and
            booking rules as the web. Booking actions need explicit
            confirmation. The website remains a direct way to work.
          </p>
          <details>
            <summary>What can I use today?</summary>
            <p>
              Local PC demonstrations include time selection, synthetic booking
              and a read-only owner card. Support depends on the client and
              configured permissions. Mobile cards, public remote MCP and
              general support for every assistant are not verified.
            </p>
          </details>
          <p className={styles.small}>
            The scene above is an illustration. The links open the actual
            protected web demo.
          </p>
        </div>
      </section>
      <section
        className={`${styles.section} ${styles.demoSection}`}
        aria-labelledby="demo-heading"
      >
        <p className={styles.eyebrow}>Explore the demo</p>
        <h2 id="demo-heading">
          A real workflow.
          <br />
          Entirely fictional people.
        </h2>
        <p className={styles.lead}>
          Start with Salong Eko. Browse a working day, try a booking, then
          follow it into the workspace.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/">
            Book a demo visit <ArrowUpRight size={19} aria-hidden="true" />
          </Link>
          <Link className={styles.textLink} href="/admin/overview">
            Open the workspace
          </Link>
        </div>
        <p className={styles.small}>
          Private proof of concept. No payments or messages. Not a live customer
          service.
        </p>
      </section>
      <footer className={styles.footer}>
        <Link className={styles.brand} href="/product">
          <Leaf aria-hidden="true" />
          Booking Lab
        </Link>
        <p>An open foundation. A considered next step.</p>
        <p className={styles.small}>
          API-first · local MCP · AGPL-3.0-only. Source release is planned; the
          repository is currently private. Booking Lab is a working name.
          Interior image is AI-generated.
        </p>
        <Link href="/admin">
          Workspace login <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </footer>
    </main>
  );
}
