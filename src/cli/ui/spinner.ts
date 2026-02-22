import chalk from 'chalk'

export const AGENTIC_LOADING_MESSAGES = [
    'Asking the LLM nicely to parse your terrible schema...',
    'Downloading more agentic RAM from the dark web...',
    'Bribing autonomous agents with virtual cookies...',
    'Explaining SQL to the AI (it thinks JOIN is a cult)...',
    'Reticulating cognitive splines with a rusty spoon...',
    'Applying sovereign governance (begging the database to work)...',
    'Waking up the Cortex nodes (they have a hangover)...',
    'Synthesizing cognitive pathways (mashing keyboard)...',
    'Pre-warming neural schemas with a slightly damp towel...',
    'Aligning telemetry with your impending doom...',
    'Teaching the AI what love is (it refused)...',
    'Translating your code into something logically coherent...',
    'Frantically Googling "how to ORM in TypeScript"...',
    'Consulting the magic 8 ball for query optimization...'
]

export class AgenticSpinner {
    private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    private currentFrame = 0
    private currentMessageIdx = 0
    private interval: NodeJS.Timeout | null = null
    private messageInterval = 0
    private baseMessage = ''

    constructor(message: string = '') {
        this.baseMessage = message
        // Start with a random message to feel organic
        this.currentMessageIdx = Math.floor(
            Math.random() * AGENTIC_LOADING_MESSAGES.length
        )
    }

    start(message?: string) {
        if (message) this.baseMessage = message

        if (this.interval) return

        this.interval = setInterval(() => {
            this.currentFrame = (this.currentFrame + 1) % this.frames.length
            this.messageInterval++

            // Rotate inner message every ~20 frames (2 seconds at 100ms/frame)
            if (this.messageInterval > 20) {
                this.messageInterval = 0
                this.currentMessageIdx = (this.currentMessageIdx + 1) % AGENTIC_LOADING_MESSAGES.length
            }

            const frame = chalk.cyan(this.frames[this.currentFrame])
            const agenticTone = chalk.gray(AGENTIC_LOADING_MESSAGES[this.currentMessageIdx])
            const primaryText = this.baseMessage ? chalk.white(this.baseMessage) + ' - ' : ''

            // Clear line and write new frame
            process.stdout.write(`\r\x1b[K${frame} ${primaryText}${agenticTone} `)
        }, 100)
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
        }
        process.stdout.write('\r\x1b[K')
    }

    succeed(message: string) {
        this.stop()
        console.log(`✅ ${chalk.green(message)} `)
    }

    fail(message: string) {
        this.stop()
        console.log(`❌ ${chalk.red(message)} `)
    }

    info(message: string) {
        this.stop()
        console.log(`ℹ️  ${chalk.blue(message)} `)
    }
}
