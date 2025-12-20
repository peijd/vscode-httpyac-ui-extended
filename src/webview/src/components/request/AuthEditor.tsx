import React from 'react';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import type { AuthConfig, AuthType } from '@/types';

interface AuthEditorProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'oauth2', label: 'OAuth 2.0' },
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
    </div>
  );
};

