import React from 'react';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import type { AuthConfig, AuthType } from '@/types';

interface AuthEditorProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}

const AUTH_TYPES: { value: AuthType; label: string; description?: string }[] = [
  { value: 'none', label: 'No Auth', description: 'No authentication' },
  { value: 'basic', label: 'Basic Auth', description: 'Username & password' },
  { value: 'bearer', label: 'Bearer Token', description: 'Token-based auth' },
  { value: 'apikey', label: 'API Key', description: 'Key in header or query' },
  { value: 'digest', label: 'Digest Auth', description: 'HTTP Digest auth' },
  { value: 'oauth2', label: 'OAuth 2.0', description: 'OAuth 2.0 flows' },
  { value: 'aws', label: 'AWS Signature', description: 'AWS Signature v4' },
];

export const AuthEditor: React.FC<AuthEditorProps> = ({ auth, onChange }) => {
  const handleTypeChange = (type: AuthType) => {
    onChange({ ...auth, type });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="section-header">Type</label>
        <Select value={auth.type} onValueChange={(v) => handleTypeChange(v as AuthType)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {auth.type === 'basic' && (
        <div className="space-y-3">
          <div>
            <label className="section-header">Username</label>
            <Input
              value={auth.basic?.username || ''}
              onChange={(e) =>
                onChange({
                  ...auth,
                  basic: { ...auth.basic, username: e.target.value, password: auth.basic?.password || '' },
                })
              }
              placeholder="Username"
            />
          </div>
          <div>
            <label className="section-header">Password</label>
            <Input
              type="password"
              value={auth.basic?.password || ''}
              onChange={(e) =>
                onChange({
                  ...auth,
                  basic: { ...auth.basic, password: e.target.value, username: auth.basic?.username || '' },
                })
              }
              placeholder="Password"
            />
          </div>
        </div>
      )}

      {auth.type === 'bearer' && (
        <div>
          <label className="section-header">Token</label>
          <Input
            value={auth.bearer?.token || ''}
            onChange={(e) =>
              onChange({
                ...auth,
                bearer: { token: e.target.value },
              })
            }
            placeholder="Bearer token"
          />
          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-1">
            The token will be sent as: Authorization: Bearer &lt;token&gt;
          </p>
        </div>
      )}

      {auth.type === 'apikey' && (
        <div className="space-y-3">
          <div>
            <label className="section-header">Add to</label>
            <Select
              value={auth.apikey?.addTo || 'header'}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  apikey: {
                    ...auth.apikey,
                    addTo: v as 'header' | 'query',
                    key: auth.apikey?.key || '',
                    value: auth.apikey?.value || '',
                  },
                })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query Params</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-header">
                {auth.apikey?.addTo === 'query' ? 'Param Name' : 'Header Name'}
              </label>
              <Input
                value={auth.apikey?.key || ''}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    apikey: {
                      ...auth.apikey,
                      key: e.target.value,
                      addTo: auth.apikey?.addTo || 'header',
                      value: auth.apikey?.value || '',
                    },
                  })
                }
                placeholder={auth.apikey?.addTo === 'query' ? 'api_key' : 'X-API-Key'}
              />
            </div>
            <div>
              <label className="section-header">Value</label>
              <Input
                value={auth.apikey?.value || ''}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    apikey: {
                      ...auth.apikey,
                      value: e.target.value,
                      addTo: auth.apikey?.addTo || 'header',
                      key: auth.apikey?.key || '',
                    },
                  })
                }
                placeholder="Your API key"
              />
            </div>
          </div>
        </div>
      )}

      {auth.type === 'digest' && (
        <div className="space-y-3">
          <div>
            <label className="section-header">Username</label>
            <Input
              value={auth.digest?.username || ''}
              onChange={(e) =>
                onChange({
                  ...auth,
                  digest: {
                    ...auth.digest,
                    username: e.target.value,
                    password: auth.digest?.password || '',
                  },
                })
              }
              placeholder="Username"
            />
          </div>
          <div>
            <label className="section-header">Password</label>
            <Input
              type="password"
              value={auth.digest?.password || ''}
              onChange={(e) =>
                onChange({
                  ...auth,
                  digest: {
                    ...auth.digest,
                    password: e.target.value,
                    username: auth.digest?.username || '',
                  },
                })
              }
              placeholder="Password"
            />
          </div>
          <div>
            <label className="section-header">Realm (optional)</label>
            <Input
              value={auth.digest?.realm || ''}
              onChange={(e) =>
                onChange({
                  ...auth,
                  digest: {
                    ...auth.digest,
                    realm: e.target.value,
                    username: auth.digest?.username || '',
                    password: auth.digest?.password || '',
                  },
                })
              }
              placeholder="Realm"
            />
          </div>
          <p className="text-xs text-[var(--vscode-descriptionForeground)]">
            HTTP Digest authentication. The realm is usually provided by the server.
          </p>
        </div>
      )}

      {auth.type === 'oauth2' && (
        <div className="space-y-3">
          <div>
            <label className="section-header">Grant Type</label>
            <Select
              value={auth.oauth2?.grantType || 'client_credentials'}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  oauth2: {
                    ...auth.oauth2,
                    grantType: v as 'client_credentials' | 'authorization_code' | 'password',
                    tokenUrl: auth.oauth2?.tokenUrl || '',
                    clientId: auth.oauth2?.clientId || '',
                    clientSecret: auth.oauth2?.clientSecret || '',
                  },
                })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_credentials">Client Credentials</SelectItem>
                <SelectItem value="authorization_code">Authorization Code</SelectItem>
                <SelectItem value="password">Password</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="section-header">Token URL</label>
            <Input
              value={auth.oauth2?.tokenUrl || ''}
              onChange={(e) =>
                onChange({
                  ...auth,
                  oauth2: {
                    ...auth.oauth2,
                    tokenUrl: e.target.value,
                    grantType: auth.oauth2?.grantType || 'client_credentials',
                    clientId: auth.oauth2?.clientId || '',
                    clientSecret: auth.oauth2?.clientSecret || '',
                  },
                })
              }
              placeholder="https://example.com/oauth/token"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-header">Client ID</label>
              <Input
                value={auth.oauth2?.clientId || ''}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    oauth2: {
                      ...auth.oauth2,
                      clientId: e.target.value,
                      grantType: auth.oauth2?.grantType || 'client_credentials',
                      tokenUrl: auth.oauth2?.tokenUrl || '',
                      clientSecret: auth.oauth2?.clientSecret || '',
                    },
                  })
                }
                placeholder="Client ID"
              />
            </div>
            <div>
              <label className="section-header">Client Secret</label>
              <Input
                type="password"
                value={auth.oauth2?.clientSecret || ''}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    oauth2: {
                      ...auth.oauth2,
                      clientSecret: e.target.value,
                      grantType: auth.oauth2?.grantType || 'client_credentials',
                      tokenUrl: auth.oauth2?.tokenUrl || '',
                      clientId: auth.oauth2?.clientId || '',
                    },
                  })
                }
                placeholder="Client Secret"
              />
            </div>
          </div>
          <div>
            <label className="section-header">Scope (optional)</label>
            <Input
              value={auth.oauth2?.scope || ''}
              onChange={(e) =>
                onChange({
                  ...auth,
                  oauth2: {
                    ...auth.oauth2,
                    scope: e.target.value,
                    grantType: auth.oauth2?.grantType || 'client_credentials',
                    tokenUrl: auth.oauth2?.tokenUrl || '',
                    clientId: auth.oauth2?.clientId || '',
                    clientSecret: auth.oauth2?.clientSecret || '',
                  },
                })
              }
              placeholder="read write"
            />
          </div>
        </div>
      )}

      {auth.type === 'aws' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-header">Access Key ID</label>
              <Input
                value={auth.aws?.accessKeyId || ''}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    aws: {
                      ...auth.aws,
                      accessKeyId: e.target.value,
                      secretAccessKey: auth.aws?.secretAccessKey || '',
                      region: auth.aws?.region || '',
                      service: auth.aws?.service || '',
                    },
                  })
                }
                placeholder="AKIAIOSFODNN7EXAMPLE"
              />
            </div>
            <div>
              <label className="section-header">Secret Access Key</label>
              <Input
                type="password"
                value={auth.aws?.secretAccessKey || ''}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    aws: {
                      ...auth.aws,
                      secretAccessKey: e.target.value,
                      accessKeyId: auth.aws?.accessKeyId || '',
                      region: auth.aws?.region || '',
                      service: auth.aws?.service || '',
                    },
                  })
                }
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-header">Region</label>
              <Input
                value={auth.aws?.region || ''}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    aws: {
                      ...auth.aws,
                      region: e.target.value,
                      accessKeyId: auth.aws?.accessKeyId || '',
                      secretAccessKey: auth.aws?.secretAccessKey || '',
                      service: auth.aws?.service || '',
                    },
                  })
                }
                placeholder="us-east-1"
              />
            </div>
            <div>
              <label className="section-header">Service</label>
              <Input
                value={auth.aws?.service || ''}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    aws: {
                      ...auth.aws,
                      service: e.target.value,
                      accessKeyId: auth.aws?.accessKeyId || '',
                      secretAccessKey: auth.aws?.secretAccessKey || '',
                      region: auth.aws?.region || '',
                    },
                  })
                }
                placeholder="execute-api, s3, etc."
              />
            </div>
          </div>
          <div>
            <label className="section-header">Session Token (optional)</label>
            <Input
              value={auth.aws?.sessionToken || ''}
              onChange={(e) =>
                onChange({
                  ...auth,
                  aws: {
                    ...auth.aws,
                    sessionToken: e.target.value,
                    accessKeyId: auth.aws?.accessKeyId || '',
                    secretAccessKey: auth.aws?.secretAccessKey || '',
                    region: auth.aws?.region || '',
                    service: auth.aws?.service || '',
                  },
                })
              }
              placeholder="For temporary credentials (STS)"
            />
          </div>
          <p className="text-xs text-[var(--vscode-descriptionForeground)]">
            AWS Signature Version 4 authentication for AWS services.
          </p>
        </div>
      )}
    </div>
  );
};

