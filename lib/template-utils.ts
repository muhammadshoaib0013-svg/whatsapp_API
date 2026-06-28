/**
 * Template utility functions for parsing and displaying WhatsApp templates
 */

export interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  example?: any;
  buttons?: any[];
  parameters?: any[];
}

export interface ParsedTemplate {
  header: TemplateComponent | null;
  body: TemplateComponent | null;
  footer: TemplateComponent | null;
  buttons: TemplateComponent | null;
  variables: string[];
  hasMedia: boolean;
  mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}

/**
 * Parse template components from Meta API format
 */
export function parseTemplateComponents(componentsJson: any[]): ParsedTemplate {
  const parsed: ParsedTemplate = {
    header: null,
    body: null,
    footer: null,
    buttons: null,
    variables: [],
    hasMedia: false,
  };

  if (!componentsJson || !Array.isArray(componentsJson)) {
    return parsed;
  }

  for (const component of componentsJson) {
    switch (component.type) {
      case 'HEADER':
        parsed.header = component;
        if (component.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format)) {
          parsed.hasMedia = true;
          parsed.mediaType = component.format as 'IMAGE' | 'VIDEO' | 'DOCUMENT';
        }
        break;
      case 'BODY':
        parsed.body = component;
        // Extract variables from body text
        if (component.text) {
          parsed.variables = extractVariables(component.text);
        }
        break;
      case 'FOOTER':
        parsed.footer = component;
        break;
      case 'BUTTONS':
        parsed.buttons = component;
        break;
    }
  }

  return parsed;
}

/**
 * Extract variables from template text
 * Variables are in format {{1}}, {{2}}, etc.
 */
export function extractVariables(text: string): string[] {
  const regex = /\{\{(\d+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables.sort((a, b) => parseInt(a) - parseInt(b));
}

/**
 * Replace variables in template text with provided values
 */
export function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Get category badge color
 */
export function getCategoryBadgeColor(category: string): string {
  const categoryLower = category.toLowerCase();
  
  if (categoryLower === 'marketing') return 'bg-purple-100 text-purple-800';
  if (categoryLower === 'utility') return 'bg-blue-100 text-blue-800';
  if (categoryLower === 'authentication') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
}

/**
 * Get status badge color
 */
export function getStatusBadgeColor(status: string): string {
  const statusLower = status.toLowerCase();
  
  if (statusLower === 'approved') return 'bg-green-100 text-green-800';
  if (statusLower === 'pending') return 'bg-yellow-100 text-yellow-800';
  if (statusLower === 'rejected') return 'bg-red-100 text-red-800';
  if (statusLower === 'disabled') return 'bg-gray-100 text-gray-800';
  if (statusLower === 'paused') return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-800';
}

/**
 * Get language badge color
 */
export function getLanguageBadgeColor(language: string): string {
  const languageLower = language.toLowerCase();
  
  if (languageLower === 'en' || languageLower === 'en_us') return 'bg-indigo-100 text-indigo-800';
  if (languageLower === 'es') return 'bg-pink-100 text-pink-800';
  if (languageLower === 'fr') return 'bg-cyan-100 text-cyan-800';
  if (languageLower === 'de') return 'bg-teal-100 text-teal-800';
  if (languageLower === 'pt') return 'bg-lime-100 text-lime-800';
  if (languageLower === 'ar') return 'bg-amber-100 text-amber-800';
  if (languageLower === 'hi') return 'bg-rose-100 text-rose-800';
  return 'bg-gray-100 text-gray-800';
}

/**
 * Format language code to display name
 */
export function formatLanguage(language: string): string {
  const languageMap: Record<string, string> = {
    'en': 'English',
    'en_US': 'English (US)',
    'en_GB': 'English (UK)',
    'es': 'Spanish',
    'es_ES': 'Spanish (Spain)',
    'es_MX': 'Spanish (Mexico)',
    'fr': 'French',
    'fr_FR': 'French (France)',
    'de': 'German',
    'de_DE': 'German (Germany)',
    'pt': 'Portuguese',
    'pt_BR': 'Portuguese (Brazil)',
    'pt_PT': 'Portuguese (Portugal)',
    'it': 'Italian',
    'it_IT': 'Italian (Italy)',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'zh': 'Chinese',
    'zh_CN': 'Chinese (Simplified)',
    'zh_TW': 'Chinese (Traditional)',
    'ja': 'Japanese',
    'ja_JP': 'Japanese (Japan)',
    'ko': 'Korean',
    'ko_KR': 'Korean (South Korea)',
    'ru': 'Russian',
    'ru_RU': 'Russian (Russia)',
    'nl': 'Dutch',
    'nl_NL': 'Dutch (Netherlands)',
    'tr': 'Turkish',
    'tr_TR': 'Turkish (Turkey)',
    'id': 'Indonesian',
    'id_ID': 'Indonesian (Indonesia)',
    'ms': 'Malay',
    'ms_MY': 'Malay (Malaysia)',
    'th': 'Thai',
    'th_TH': 'Thai (Thailand)',
    'vi': 'Vietnamese',
    'vi_VN': 'Vietnamese (Vietnam)',
    'sw': 'Swahili',
    'sw_KE': 'Swahili (Kenya)',
  };

  return languageMap[language] || language;
}

/**
 * Format category to display name
 */
export function formatCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    'MARKETING': 'Marketing',
    'UTILITY': 'Utility',
    'AUTHENTICATION': 'Authentication',
  };

  return categoryMap[category] || category;
}
