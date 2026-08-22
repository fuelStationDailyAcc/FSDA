const STEPS = [
  {
    step: '01',
    title: 'Open the day',
    description: 'Pick a date and open your accounting sheet. PetroBook creates the day only when you need it.',
  },
  {
    step: '02',
    title: 'Enter readings & entries',
    description: 'Log meter readings, credit/debit, expenses, and non-cash collections as they happen.',
  },
  {
    step: '03',
    title: 'Reconcile cash',
    description: 'Compare expected cash against what was taken home. Pending amounts roll to the next day.',
  },
  {
    step: '04',
    title: 'Close & analyze',
    description: 'Lock the day when done. Review history and profit trends anytime from your dashboard.',
  },
]

function LandingWorkflow() {
  return (
    <section className="landing-section landing-section-muted" id="workflow">
      <div className="landing-container">
        <div className="landing-section-head landing-section-head-center">
          <p className="landing-eyebrow">Simple workflow</p>
          <h2>From open to close in four steps</h2>
          <p className="landing-section-lead">
            Designed around how petrol pumps actually work — fast data entry at the counter,
            accurate closing at end of day.
          </p>
        </div>

        <ol className="landing-steps">
          {STEPS.map((item, index) => (
            <li key={item.step} className="landing-step">
              <div className="landing-step-marker">
                <span>{item.step}</span>
                {index < STEPS.length - 1 ? <span className="landing-step-line" aria-hidden="true" /> : null}
              </div>
              <div className="landing-step-body">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default LandingWorkflow
