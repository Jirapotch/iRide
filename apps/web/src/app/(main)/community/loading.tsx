export default function CommunityLoading() {
  return (
    <main className="community-page" aria-busy="true">
      <header className="community-heading">
        <p className="premium-kicker">iRide Community</p>
      </header>
      <section className="community-feed" role="status">
        <article className="premium-card community-post">
          <p>กำลังโหลดชุมชน…</p>
        </article>
      </section>
    </main>
  );
}
