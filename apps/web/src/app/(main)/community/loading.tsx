export default function CommunityLoading() {
  return (
    <main className="community-page" aria-busy="true">
      <header className="community-heading">
        <div className="skeleton-line" aria-hidden="true" />
      </header>
      <section className="community-feed" role="status">
        <article className="premium-card community-post">
          <p>กำลังโหลดชุมชน…</p>
        </article>
      </section>
    </main>
  );
}
