import { Link } from 'react-router-dom'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <div className="panel panel-pad">
        <p className="section-sub">
          این بخش در فازهای بعدی طبق Plan پیاده‌سازی می‌شود. هسته فعلی: داشبورد، تقویم، محتوا، دارایی‌ها،
          تلگرام و استودیو.
        </p>
        <div className="form-actions">
          <Link to="/" className="btn btn-solid btn-sm">
            داشبورد
          </Link>
          <Link to="/content" className="btn btn-outline btn-sm">
            محتوا
          </Link>
        </div>
      </div>
    </div>
  )
}
