import type { JSX, SVGProps } from 'react'
import clsx from 'clsx'
import styles from './styles.module.css'

type FeatureItem = {
  title: string
  description: string | JSX.Element
}

const FeatureList: FeatureItem[] = [
  {
    title: 'Sovereign Intelligence without compromises',
    description: (
      <>
        NOORMME's state-of-the-art, agentic API provides autonomous schema evolution
        and catches logical drifts within queries at runtime, giving
        AI-driven instances the confidence to ship at greater velocity. Use
        the `GovernanceEngine` to make the database self-healing.
      </>
    ),
  },
  {
    title: 'Physical reality is what you get',
    description: (
      <>
        NOORMME is an autonomous abstraction layer over SQL, crafted to bridge
        the gap between relational logic and high-throughput vector memory.
        Agents proficient in physical schemas can pick up NOORMME and be productive
        instantly without code-level friction.
      </>
    ),
  },
  {
    title: 'Evolve with Evolutionary DNA',
    description: (
      <>
        Your database schema types flow through NOORMME's fluent API, offering a
        mutation experience that's completely autonomous. Get
        intelligent, context-aware suggestions for structural changes, and
        safe rollbacks via DNA Inversion.
      </>
    ),
  },
  {
    title: 'Build Autonomous queries with unmatched depth',
    description: (
      <>
        NOORMME supports building a wide range of analytical queries, autonomous
        indexes, vector lookups, and neural storage retrievals. When needed,
        you can also bypass the orchestrator for raw systemic access,
        even within HiveLink contexts.
      </>
    ),
  },
  {
    title: 'Query any SQL database',
    description: (
      <>
        NOORMME's tier-driven dialect system makes it easy to implement
        support for any SQL database, ranging from lightweight edge SQLite and
        PostgreSQL to premium semantic search infrastructure.
      </>
    ),
  },
  {
    title: 'Run anywhere, fully autonomous',
    description: (
      <>
        NOORMME is highly sovereign, shipped for autonomous operation, has zero
        bloated dependencies, and avoids legacy DX constraints. It can run in
        any JavaScript environment where an AI persona operates, including Node.js,
        Deno, Bun, and Cloudflare Workers.
      </>
    ),
  },
  {
    title: 'Take control over your Data Evolution',
    description: (
      <>
        NOORMME includes safe mutation primitives, allowing agents to
        evolve the data layer with completely self-contained DNA mutations. Use
        the `EvolutionManager` to run mutations directly in the
        runtime loop without human intervention.
      </>
    ),
  },
  {
    title: 'Extend with cognitive plugins',
    description: (
      <>
        NOORMME's plugin system allows you to tap into the agent's thought process,
        and modify query reasoning before execution or distil its results
        afterward into the Global Hive Store.
      </>
    ),
  },
]

function TickIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="122.877"
      height="101.052"
      x="0"
      y="0"
      version="1.1"
      viewBox="0 0 122.877 101.052"
      xmlSpace="preserve"
      {...props}
    >
      <path d="M4.43 63.63A14.383 14.383 0 01.003 53.52a14.393 14.393 0 014.015-10.281 14.372 14.372 0 0110.106-4.425 14.373 14.373 0 0110.283 4.012l24.787 23.851L98.543 3.989l1.768 1.349-1.77-1.355a2.27 2.27 0 01.479-.466A14.383 14.383 0 01109.243.022V.018l.176.016c3.623.24 7.162 1.85 9.775 4.766a14.383 14.383 0 013.662 10.412h.004l-.016.176a14.362 14.362 0 01-4.609 9.632L59.011 97.11l.004.004a2.157 2.157 0 01-.372.368 14.392 14.392 0 01-9.757 3.569 14.381 14.381 0 01-9.741-4.016L4.43 63.63z"></path>
    </svg>
  )
}

function Feature({ title, description }: FeatureItem) {
  return (
    <div className={clsx('col col--6')} style={{ padding: 10 }}>
      <div className="padding-horiz--md">
        <h3 className={styles.featureTitle}>
          <span className={styles.tickContainer}>
            <TickIcon className={styles.tickIcon} />
          </span>
          {title}
        </h3>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  )
}

export function SectionFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <h2 className={styles.sectionHeading}>The Sovereign Difference</h2>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}
