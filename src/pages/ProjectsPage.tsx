import { useEffect, useState } from 'react'
import { api, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function ProjectsPage() {
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<ProjectDto[]>([])
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!workspaceId) return
    setItems((await api.listProjects(workspaceId)).items)
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId])

  async function create() {
    if (!workspaceId || !name.trim()) return
    await api.createProject({ workspaceId, name: name.trim(), clientName, description })
    setName('')
    setClientName('')
    setDescription('')
    await reload()
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>پروژه‌ها</h1>
          <p>ساختار کلاینت / پروژه برای سازماندهی محتوا</p>
        </div>
      </header>
      {error && <p className="section-sub">{error}</p>}
      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">پروژه جدید</h2>
          <div className="field">
            <label>نام</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>کلاینت</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div className="field">
            <label>توضیح</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="button" className="btn btn-solid" onClick={() => void create()}>
            ذخیره
          </button>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">لیست پروژه‌ها</h2>
          <div className="page-list">
            {items.map((p) => (
              <article key={p.id} className="list-item">
                <h3>{p.name}</h3>
                {p.clientName && <p>کلاینت: {p.clientName}</p>}
                {p.description && <p>{p.description}</p>}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => void api.deleteProject(p.id).then(reload)}
                >
                  حذف
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
