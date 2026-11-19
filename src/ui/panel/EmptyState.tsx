/** Directions shown before a plot is drawn. */
export function EmptyState() {
  return (
    <section className="panel-section empty" aria-labelledby="empty-heading">
      <h2 id="empty-heading" className="empty__title">
        Draw your plot
      </h2>
      <ol className="steps">
        <li>Click on the map to place the corners of your plot.</li>
        <li>Click the first corner again to close it.</li>
        <li>Say which side faces the road, and how wide the road is.</li>
      </ol>
      <p className="empty__after">The allowed space, two concept designs and a checklist against each rule appear here.</p>
    </section>
  );
}
