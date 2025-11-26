import { getApiBaseUrl } from '../services/api';

/**
 * API Configuration Info Component
 * Displays current API configuration in development mode
 */
export function ApiConfigInfo() {
  // Only show in development mode
  if (import.meta.env.PROD) {
    return null;
  }

  const apiUrl = getApiBaseUrl();
  const isDefault = apiUrl === 'http://localhost:8000';

  return (
    <div className="api-config-info" style={{
      padding: '12px',
      margin: '16px 0',
      backgroundColor: '#f0f0f0',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '14px',
      color: '#666'
    }}>
      <strong>🔧 Development Info:</strong>
      <div style={{ marginTop: '8px' }}>
        <strong>API Base URL:</strong> <code style={{ 
          padding: '2px 6px', 
          backgroundColor: '#fff', 
          borderRadius: '3px',
          fontFamily: 'monospace'
        }}>{apiUrl}</code>
      </div>
      {isDefault && (
        <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
          Using default API URL. Set <code>VITE_API_BASE_URL</code> environment variable to change.
        </div>
      )}
      {!isDefault && (
        <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
          Using custom API URL from environment variable.
        </div>
      )}
    </div>
  );
}



