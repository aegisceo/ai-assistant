/**
 * Simple Email Test Component
 * Just to test if basic email fetching works
 */

'use client';

import React, { useState } from 'react';

export function SimpleEmailTest(): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const testEmailFetch = async () => {
    setLoading(true);
    setResult('');
    
    try {
      console.log('Testing email fetch...');
      const response = await fetch('/api/gmail/emails?maxResults=3&labelIds=INBOX', {
        credentials: 'include',
      });
      
      console.log('Response:', response.status, response.statusText);
      const text = await response.text();
      console.log('Response text:', text);
      
      setResult(`Status: ${response.status}\nResponse: ${text}`);
    } catch (error) {
      console.error('Error:', error);
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Email Fetch Test</h3>
      <button 
        onClick={testEmailFetch}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Email Fetch'}
      </button>
      
      {result && (
        <pre className="mt-4 p-2 bg-gray-100 text-xs overflow-auto">
          {result}
        </pre>
      )}
    </div>
  );
}