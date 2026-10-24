const suggestionGroups: Record<string, string[]> = {
  'Soft Skills': [
    'Communication', 'Customer Service', 'Teamwork', 'Problem Solving', 'Time Management',
    'Adaptability', 'Attention to Detail', 'Conflict Resolution', 'Critical Thinking', 'Leadership',
    'Negotiation', 'Organization', 'Presentation Skills', 'Relationship Building', 'Written Communication',
  ],
  'Technical Skills': [
    'Data Analysis', 'SQL', 'Python', 'JavaScript', 'TypeScript', 'API Integration', 'Cloud Computing',
    'Cybersecurity', 'Data Modeling', 'Machine Learning', 'Network Administration', 'Quality Assurance',
    'Requirements Analysis', 'System Design', 'Technical Documentation', 'Testing Automation',
  ],
  'Industry-Specific Skills': [
    'Budget Management', 'Case Management', 'Clinical Documentation', 'Compliance', 'Customer Retention',
    'Demand Forecasting', 'Inventory Management', 'Market Research', 'Patient Care', 'Process Improvement',
    'Project Management', 'Quality Control', 'Risk Assessment', 'Sales Forecasting', 'Supply Chain Management',
  ],
  'Tools & Software': [
    'Adobe Creative Cloud', 'Excel', 'Figma', 'Google Analytics', 'Jira', 'Microsoft Power BI',
    'Microsoft Project', 'Microsoft Teams', 'QuickBooks', 'Salesforce', 'SAP', 'ServiceNow',
    'Slack', 'Tableau', 'Visual Studio Code',
  ],
}

export function getSkillSuggestions(categoryName: string, query = '') {
  const categoryKey = Object.keys(suggestionGroups).find((key) => key.toLocaleLowerCase() === categoryName.trim().toLocaleLowerCase())
  const source = categoryKey ? suggestionGroups[categoryKey] ?? [] : []
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return source.filter((skill) => !normalizedQuery || skill.toLocaleLowerCase().includes(normalizedQuery))
}

export function getAllSkillSuggestions() {
  return [...new Set(Object.values(suggestionGroups).flat())]
}
