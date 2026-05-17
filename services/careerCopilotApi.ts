
// This would be published as an NPM package, but for now, it's a local file.
// Developers would import this into their projects.

export class CareerCopilotAPI {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string, apiUrl: string = 'https://tchwdtylvdijcqfcuenf.supabase.co/functions/v1/api') {
    if (!apiKey) {
      throw new Error('Career CoPilot API key is required.');
    }
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  private async makeRequest(endpoint: string, payload: object) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ endpoint, payload }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Analyzes a resume text for a specific job market.
   * @param {string} resumeText - The full text of the resume.
   * @param {string} marketName - The target job market (e.g., 'Canada', 'United States').
   * @returns {Promise<object>} An object containing the analysis result.
   */
  async analyzeResume({ resumeText, marketName }: { resumeText: string; marketName: string }): Promise<any> {
    if (!resumeText || !marketName) {
      throw new Error('resumeText and marketName are required for analyzeResume.');
    }
    return this.makeRequest('analyzeResume', { resumeText, marketName });
  }
  
  /**
   * Generates a cover letter based on a resume and job description.
   * @param {string} resumeText - The full text of the resume.
   * @param {string} jobDescription - The full text of the job description.
   * @returns {Promise<object>} An object containing the generated cover letter.
   */
  async generateCoverLetter({ resumeText, jobDescription }: { resumeText: string; jobDescription: string }): Promise<any> {
    if (!resumeText || !jobDescription) {
      throw new Error('resumeText and jobDescription are required for generateCoverLetter.');
    }
    return this.makeRequest('generateCoverLetter', { resumeText, jobDescription });
  }
}
