import { UploadForm } from '../components/UploadForm';
import { UploadQueue } from '../components/UploadQueue';

export function ClaimUploadPage() {
  return (
    <div className="claim-upload-page">
      <header className="page-header">
        <h1>Claim System File Uploader</h1>
        <p className="subtitle">
          Upload X12 or CSV files for processing. This is an internal tool for controlled
          environments.
        </p>
      </header>

      <main className="page-content">
        <div className="upload-section">
          <UploadForm />
        </div>

        <div className="queue-section">
          <UploadQueue />
        </div>

        <div className="history-link-section">
          <a href="#" className="link">
            View History →
          </a>
        </div>
      </main>
    </div>
  );
}

