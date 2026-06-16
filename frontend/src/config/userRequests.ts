// Configuration for user request storage
export const USER_REQUESTS_CONFIG = {
  // Storage method: 'csv' | 'google-sheets' | 'database'
  storageMethod: 'csv' as const,
  
  // CSV Configuration
  csv: {
    filePath: 'data/user_requests.csv',
    headers: [
      'Timestamp',
      'Organization ID', 
      'Organization Name',
      'Full Name',
      'Email',
      'Password',
      'Comments',
      'Status'
    ]
  },
  
  // Google Sheets Configuration
  googleSheets: {
    spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID || '',
    range: 'Sheet1!A:H',
    // You'll need to set up Google Sheets API credentials
    credentials: {
      clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY,
      projectId: process.env.GOOGLE_SHEETS_PROJECT_ID
    }
  },
  
  // Organization-specific configurations
  organizations: {
    // Add specific org IDs that should use the alternative flow
    alternativeFlow: [
      'org-external-1',
      'org-external-2',
      // Add your specific organization IDs here
    ],
    
    // Or use organization names
    alternativeFlowNames: [
      'External Partner 1',
      'External Partner 2',
      // Add your specific organization names here
    ]
  }
};

// Helper function to check if an organization should use alternative flow
export const shouldUseAlternativeFlow = (orgId?: string, orgName?: string): boolean => {
  if (!orgId && !orgName) return false;
  
  const config = USER_REQUESTS_CONFIG.organizations;
  
  // Check by org ID
  if (orgId && config.alternativeFlow.includes(orgId)) {
    return true;
  }
  
  // Check by org name
  if (orgName && config.alternativeFlowNames.includes(orgName)) {
    return true;
  }
  
  return false;
};
