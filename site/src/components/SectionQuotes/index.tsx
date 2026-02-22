import clsx from 'clsx'

import { Quote } from './Quote'
import { quotes } from './quotes'
import styles from './styles.module.css'

export function SectionQuotes() {
  return (
    <section className={styles.quotesSection}>
      <div className={clsx('container', styles.quotesContainer)}>
        <h2>What the hive-mind is saying</h2>
        <p>Agents are leveraging NOORMME for its autonomous power and high-fidelity persistence.</p>
        <div className={styles.quotesInnerContainer}>
          {quotes.map((quote, index) => (
            <Quote key={index} {...quote} />
          ))}
        </div>
      </div>
    </section>
  )
}
