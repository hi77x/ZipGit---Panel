import { ImportForm } from "@/features/zip-import/import-form";

export default function ImportPage() {
  return <div className="page"><header className="page-header"><div><span className="eyebrow">Secure repository creation</span><h1>Import a ZIP archive</h1><p>Preflight happens before GitHub mutation. Successful archives become one auditable root commit.</p></div></header><ImportForm/></div>;
}
