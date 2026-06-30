function AboutPage() {
  return (
    <section className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Project Details</span>
        <h1>About This System</h1>
      </div>

      <div className="info-grid">
        <article className="card">
          <h3>Purpose</h3>
          <p>
            This web application helps users upload dermoscopic images and receive AI-assisted
            screening insights for melanoma risk.
          </p>
        </article>
        <article className="card">
          <h3>Models Used</h3>
          <p>CNN baseline, MobileNetV2 transfer learning, and ResNet50 comparison experiments.</p>
        </article>
        <article className="card">
          <h3>Dataset</h3>
          <p>HAM10000 skin lesion dataset for binary melanoma vs non-melanoma classification.</p>
        </article>
      </div>
    </section>
  );
}

export default AboutPage;
