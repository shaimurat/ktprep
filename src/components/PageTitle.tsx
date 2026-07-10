export function PageTitle({ title, text }: { title: string; text: string }) {
  return (
    <header className="page-title">
      <span className="eyebrow">KT Prep Trainer</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  )
}
