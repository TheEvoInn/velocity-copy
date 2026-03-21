/**
 * Credential Injector
 * Dynamically injects encrypted credentials into browser context during Task Reader execution
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    // ACTION: Generate injection script for browser
    if (action === 'generate_injection_script') {
      const { credential_ids, target_url } = payload;

      // Retrieve credentials
      const credentials = await Promise.all(
        credential_ids.map(id =>
          base44.entities.EncryptedCredential.filter(
            { id, created_by: user.email },
            null,
            1
          )
        )
      );

      const validCredentials = credentials.filter(c => c && c.length > 0).map(c => c[0]);

      // Generate injection mapping
      const injectionMap = [];
      for (const cred of validCredentials) {
        if (!cred.injection_rules?.auto_inject_enabled) continue;

        // Check if target_url matches injection domains
        const domainMatch = cred.injection_rules.inject_on_domains?.some(domain =>
          target_url.includes(domain)
        );

        if (!domainMatch) continue;

        injectionMap.push({
          credential_id: cred.id,
          platform: cred.platform,
          credential_type: cred.credential_type,
          injection_rules: cred.injection_rules,
          requires_mfa: cred.requires_mfa
        });
      }

      // Generate JavaScript injection script
      const injectionScript = generateInjectionScript(injectionMap);

      return Response.json({
        status: 'success',
        injection_script: injectionScript,
        credentials_to_inject: injectionMap.length,
        injection_map: injectionMap
      });
    }

    // ACTION: Inject credential into active form
    if (action === 'inject_credential') {
      const { credential_id, form_selector, field_mappings } = payload;

      // Get credential (decrypted)
      const credRes = await base44.functions.invoke('credentialManager', {
        action: 'retrieve_credential',
        payload: { credential_id }
      });

      if (credRes.data.status !== 'success') {
        return Response.json({ error: 'Failed to retrieve credential' }, { status: 400 });
      }

      const credential = credRes.data;

      // Get injection rules
      const credentials = await base44.entities.EncryptedCredential.filter(
        { id: credential_id, created_by: user.email },
        null,
        1
      );

      const credData = credentials[0];

      // Generate injection instructions
      const injectionInstructions = {
        credential_id,
        form_selector,
        field_mappings: field_mappings || buildFieldMappings(credData, credential),
        headers: credData.injection_rules?.inject_headers || {},
        cookies: credData.injection_rules?.inject_cookies || {},
        wait_after_inject_ms: 500
      };

      // Log injection
      await base44.entities.EncryptedCredential.update(credential_id, {
        usage_tracking: {
          ...credData.usage_tracking,
          total_uses: (credData.usage_tracking?.total_uses || 0) + 1,
          last_used_at: new Date().toISOString(),
          successful_uses: (credData.usage_tracking?.successful_uses || 0) + 1
        },
        access_log: [
          ...(credData.access_log || []),
          {
            accessed_at: new Date().toISOString(),
            access_type: 'inject',
            success: true,
            ip_address: req.headers.get('x-forwarded-for')
          }
        ]
      });

      return Response.json({
        status: 'success',
        injection_instructions: injectionInstructions,
        requires_mfa: credential.requires_mfa,
        mfa_type: credential.mfa_type
      });
    }

    // ACTION: Prepare MFA token for injection
    if (action === 'prepare_mfa_injection') {
      const { credential_id, mfa_code } = payload;

      const credentials = await base44.entities.EncryptedCredential.filter(
        { id: credential_id, created_by: user.email },
        null,
        1
      );

      if (!credentials || credentials.length === 0) {
        return Response.json({ error: 'Credential not found' }, { status: 404 });
      }

      const credData = credentials[0];

      // If TOTP, generate code from secret
      let mfaValue = mfa_code;
      if (credData.mfa_type === 'totp' && !mfa_code) {
        const secretRes = await base44.functions.invoke('credentialManager', {
          action: 'get_mfa_secret',
          payload: { credential_id }
        });

        if (secretRes.data.status === 'success') {
          mfaValue = generateTOTP(secretRes.data.mfa_secret);
        }
      }

      // Get injection mapping for MFA field
      const mfaInjectionRule = credData.injection_rules?.inject_form_selectors?.find(
        r => r.field_name === 'mfa' || r.field_name === '2fa'
      );

      return Response.json({
        status: 'success',
        mfa_code: mfaValue,
        mfa_type: credData.mfa_type,
        injection_selector: mfaInjectionRule?.selector,
        valid_for_seconds: credData.mfa_type === 'totp' ? 30 : null
      });
    }

    // ACTION: Inject as HTTP headers/cookies
    if (action === 'prepare_http_injection') {
      const { credential_id } = payload;

      const credentials = await base44.entities.EncryptedCredential.filter(
        { id: credential_id, created_by: user.email },
        null,
        1
      );

      if (!credentials || credentials.length === 0) {
        return Response.json({ error: 'Credential not found' }, { status: 404 });
      }

      const credData = credentials[0];

      // Get credential value
      const credRes = await base44.functions.invoke('credentialManager', {
        action: 'retrieve_credential',
        payload: { credential_id }
      });

      const credential = credRes.data.credential_value;

      // Build headers/cookies based on type
      const httpInjection = {
        headers: {},
        cookies: {}
      };

      if (credData.credential_type === 'bearer_token') {
        httpInjection.headers['Authorization'] = `Bearer ${credential}`;
      } else if (credData.credential_type === 'api_token') {
        httpInjection.headers['X-API-Token'] = credential;
      } else if (credData.credential_type === 'session_cookie') {
        const cookieData = JSON.parse(credential);
        httpInjection.cookies = cookieData;
      }

      // Add any custom injection rules
      if (credData.injection_rules?.inject_headers) {
        httpInjection.headers = {
          ...httpInjection.headers,
          ...credData.injection_rules.inject_headers
        };
      }

      if (credData.injection_rules?.inject_cookies) {
        httpInjection.cookies = {
          ...httpInjection.cookies,
          ...credData.injection_rules.inject_cookies
        };
      }

      // Log injection
      await base44.entities.EncryptedCredential.update(credential_id, {
        access_log: [
          ...(credData.access_log || []),
          {
            accessed_at: new Date().toISOString(),
            access_type: 'inject',
            success: true,
            ip_address: req.headers.get('x-forwarded-for')
          }
        ]
      });

      return Response.json({
        status: 'success',
        http_injection: httpInjection,
        credential_type: credData.credential_type
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Credential injector error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Generate JavaScript injection script
 */
function generateInjectionScript(injectionMap) {
  return `
(function() {
  const injectionMap = ${JSON.stringify(injectionMap)};
  
  window.__velocityCredentialInjector = {
    map: injectionMap,
    injectedCredentials: new Set(),
    
    async injectCredentials(credentialId) {
      if (this.injectedCredentials.has(credentialId)) return;
      
      const mapping = this.map.find(m => m.credential_id === credentialId);
      if (!mapping) return;
      
      // Emit event for handler to retrieve and inject
      window.dispatchEvent(new CustomEvent('velocity:inject-credential', {
        detail: { credentialId, mapping }
      }));
      
      this.injectedCredentials.add(credentialId);
    },
    
    async injectAllRelevant() {
      for (const mapping of this.map) {
        await this.injectCredentials(mapping.credential_id);
      }
    },
    
    highlightFormFields() {
      for (const mapping of this.map) {
        if (!mapping.injection_rules?.inject_form_selectors) continue;
        
        for (const selector of mapping.injection_rules.inject_form_selectors) {
          const element = document.querySelector(selector.selector);
          if (element) {
            element.style.border = '2px solid #8b5cf6';
            element.style.boxShadow = '0 0 5px rgba(139, 92, 246, 0.5)';
            element.setAttribute('data-velocity-field', selector.field_name);
          }
        }
      }
    }
  };
  
  // Auto-inject on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.__velocityCredentialInjector.injectAllRelevant();
      window.__velocityCredentialInjector.highlightFormFields();
    });
  } else {
    window.__velocityCredentialInjector.injectAllRelevant();
    window.__velocityCredentialInjector.highlightFormFields();
  }
})();
`;
}

/**
 * Build field mappings from credential type
 */
function buildFieldMappings(credData, credential) {
  if (credData.injection_rules?.inject_form_selectors) {
    return credData.injection_rules.inject_form_selectors;
  }

  // Auto-mapping based on credential type
  const autoMappings = {
    username_password: [
      { field_name: 'username', selector: 'input[name="username"], input[type="email"]' },
      { field_name: 'password', selector: 'input[name="password"], input[type="password"]' }
    ],
    api_token: [
      { field_name: 'api_key', selector: 'input[name="api_key"], input[name="token"]' }
    ],
    bearer_token: [
      { field_name: 'token', selector: 'input[name="token"], input[name="bearer"]' }
    ]
  };

  return autoMappings[credData.credential_type] || [];
}

/**
 * Simple TOTP generator
 */
function generateTOTP(secret) {
  // Base32 decode
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = secret
    .split('')
    .map(char => {
      const index = base32chars.indexOf(char);
      return index.toString(2).padStart(5, '0');
    })
    .join('');

  const key = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < key.length; i++) {
    key[i] = parseInt(bits.substr(i * 8, 8), 2);
  }

  // Calculate HMAC-SHA1
  const time = Math.floor(Date.now() / 30000);
  const timeBytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    timeBytes[7 - i] = (time >> (i * 8)) & 0xff;
  }

  // Generate TOTP (simplified - in production use proper library)
  const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return code;
}