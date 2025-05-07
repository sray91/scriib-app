// Utility functions for documentation

/**
 * Formats a slug into a readable title
 * @param {string} slug - The slug to format
 * @returns {string} - The formatted title
 */
export function formatDocsTitle(slug) {
  // Remove file extension
  const nameWithoutExtension = slug.replace(/\.md$/, '');
  
  // Convert kebab case or snake case to space-separated
  const nameWithSpaces = nameWithoutExtension
    .replace(/-/g, ' ')
    .replace(/_/g, ' ');
  
  // Capitalize each word
  return nameWithSpaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Returns a list of available documentation files
 * @returns {Promise<Array<{slug: string, title: string}>>} - List of docs with slugs and titles
 */
export async function getAvailableDocs() {
  try {
    // Fetch the list of files from the docs API endpoint
    const response = await fetch('/api/docs');
    
    if (!response.ok) {
      throw new Error('Failed to load documentation list');
    }
    
    // Parse the response
    const { files } = await response.json();
    
    // Create the doc items with slugs and titles
    return files.map(filename => {
      const slug = filename.replace(/\.md$/, '').toLowerCase();
      return {
        slug,
        title: formatDocsTitle(filename),
      };
    });
  } catch (error) {
    console.error('Error fetching documentation list:', error);
    return [];
  }
} 