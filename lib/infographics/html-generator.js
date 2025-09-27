// HTML Generation for Infographics
export function generateInfographicHTML(infographicData, userProfile, templateId = 1) {
  const { header, contentSections, footer } = infographicData;

  const avatarUrl = userProfile?.avatar_url || '';
  const fullName = userProfile?.full_name || footer.name || 'Professional';
  const company = userProfile?.company || footer.company || 'Company';

  if (templateId === 1) {
    return generateTemplate1HTML(header, contentSections, footer, avatarUrl, fullName, company);
  } else if (templateId === 2) {
    return generateTemplate2HTML(header, contentSections, footer, avatarUrl, fullName, company);
  } else if (templateId === 3) {
    return generateTemplate3HTML(header, contentSections, footer, avatarUrl, fullName, company);
  }

  return generateTemplate1HTML(header, contentSections, footer, avatarUrl, fullName, company);
}

function generateTemplate1HTML(header, contentSections, footer, avatarUrl, fullName, company) {
  const contentHTML = contentSections.map((section, index) => `
    <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 16px;">
      ${section.generatedImageUrl ? `
        <div style="flex-shrink: 0;">
          <img src="${section.generatedImageUrl}" alt="${section.title}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover; border: 2px solid #e5e7eb;" />
        </div>
      ` : ''}
      <div style="flex: 1;">
        <h3 style="font-size: 20px; font-weight: bold; color: #1f2937; margin: 0 0 12px 0;">${section.title}</h3>
        <p style="color: #6b7280; line-height: 1.6; margin: 0;">${section.content}</p>
        ${section.items ? `
          <ul style="margin: 12px 0 0 0; padding: 0; list-style: none;">
            ${section.items.map(item => `
              <li style="display: flex; align-items: center; color: #374151; margin: 8px 0;">
                <span style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%; margin-right: 12px; flex-shrink: 0;"></span>
                ${item}
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            width: 1080px;
            height: 1080px;
            overflow: hidden;
          }
          .infographic-container {
            width: 100%;
            height: 100%;
            background: white;
            display: flex;
            flex-direction: column;
          }
        </style>
      </head>
      <body>
        <div class="infographic-container">
          <!-- Header Section -->
          <div style="background: linear-gradient(90deg, #2563eb 0%, #ef4444 100%); color: white; padding: 24px; display: flex; align-items: center; justify-content: space-between;">
            <div style="flex: 1;">
              <div style="font-size: 48px; font-weight: 900; margin-bottom: 8px; line-height: 1;">
                ${header.number ? header.number + ' ' : ''}${header.mainTitle}
              </div>
              <div style="font-size: 18px; font-weight: normal; background: #ef4444; padding: 8px 16px; border-radius: 20px; display: inline-block;">
                ${header.subtitle}
              </div>
            </div>
            ${avatarUrl ? `
              <div style="margin-left: 24px;">
                <img src="${avatarUrl}" alt="Profile" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid white; object-fit: cover;" />
              </div>
            ` : ''}
          </div>

          <!-- Content Section -->
          <div style="flex: 1; padding: 32px; background: #f9fafb; overflow-y: auto;">
            ${contentHTML}
          </div>

          <!-- Footer Section -->
          <div style="background: #1f2937; color: white; padding: 16px; display: flex; align-items: center;">
            <div style="width: 48px; height: 48px; background: #4b5563; border-radius: 50%; margin-right: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
              ${avatarUrl ? `
                <img src="${avatarUrl}" alt="Profile" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />
              ` : `
                <span style="font-size: 18px; font-weight: bold;">${fullName[0] || 'U'}</span>
              `}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: bold; font-size: 18px;">${fullName}</div>
              <div style="color: #d1d5db; font-size: 14px;">${company}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 18px;">${footer.brand || 'ENGINEERED VISION'}</div>
              <div style="color: #d1d5db; font-size: 12px;">${footer.tagline || 'INNOVATION THAT MATTERS'}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateTemplate2HTML(header, contentSections, footer, avatarUrl, fullName, company) {
  const contentHTML = contentSections.map((section, index) => `
    <div style="background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 220px;">
      ${section.generatedImageUrl ? `
        <img src="${section.generatedImageUrl}" alt="${section.title}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; margin-bottom: 12px; border: 2px solid #e5e7eb;" />
      ` : `
        <div style="width: 48px; height: 48px; background: #8b5cf6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <span style="color: white; font-weight: bold; font-size: 20px;">${index + 1}</span>
        </div>
      `}
      <h3 style="font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">${section.title}</h3>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">${section.content}</p>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            width: 1080px;
            height: 1080px;
            overflow: hidden;
          }
          .content-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; height: 100%; background: white; display: flex; flex-direction: column;">
          <!-- Header Section -->
          <div style="background: linear-gradient(90deg, #7c3aed 0%, #ec4899 100%); color: white; padding: 24px; display: flex; align-items: center; justify-content: space-between;">
            <div style="flex: 1;">
              <div style="font-size: 40px; font-weight: 900; margin-bottom: 8px; line-height: 1;">
                ${header.mainTitle}
              </div>
              <div style="font-size: 16px; font-weight: normal; background: #ec4899; padding: 8px 16px; border-radius: 20px; display: inline-block;">
                ${header.subtitle}
              </div>
            </div>
            ${avatarUrl ? `
              <div style="margin-left: 24px;">
                <img src="${avatarUrl}" alt="Profile" style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid white; object-fit: cover;" />
              </div>
            ` : ''}
          </div>

          <!-- Content Section -->
          <div style="flex: 1; padding: 24px; background: #f9fafb;">
            <div class="content-grid">
              ${contentHTML}
            </div>
          </div>

          <!-- Footer Section -->
          <div style="background: #1f2937; color: white; padding: 16px; display: flex; align-items: center;">
            <div style="width: 48px; height: 48px; background: #4b5563; border-radius: 50%; margin-right: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${avatarUrl ? `
                <img src="${avatarUrl}" alt="Profile" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />
              ` : `
                <span style="font-size: 18px; font-weight: bold;">${fullName[0] || 'U'}</span>
              `}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: bold; font-size: 18px;">${fullName}</div>
              <div style="color: #d1d5db; font-size: 14px;">${company}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 18px;">${footer.brand || 'ENGINEERED VISION'}</div>
              <div style="color: #d1d5db; font-size: 12px;">${footer.tagline || 'INNOVATION THAT MATTERS'}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateTemplate3HTML(header, contentSections, footer, avatarUrl, fullName, company) {
  const contentHTML = contentSections.map((section, index) => `
    <div style="display: flex; align-items: center; background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; position: relative; gap: 16px;">
      ${section.generatedImageUrl ? `
        <img src="${section.generatedImageUrl}" alt="${section.title}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex-shrink: 0; border: 2px solid #e5e7eb;" />
      ` : `
        <div style="width: 32px; height: 32px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: white; font-weight: bold; font-size: 14px;">${index + 1}</span>
        </div>
      `}
      <div style="flex: 1;">
        <h3 style="font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">${section.title}</h3>
        <p style="color: #6b7280; font-size: 14px;">${section.content}</p>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            width: 1080px;
            height: 1080px;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; height: 100%; background: white; display: flex; flex-direction: column;">
          <!-- Header Section -->
          <div style="background: linear-gradient(90deg, #059669 0%, #3b82f6 100%); color: white; padding: 24px; display: flex; align-items: center; justify-content: space-between;">
            <div style="flex: 1;">
              <div style="font-size: 32px; font-weight: 900; margin-bottom: 8px; line-height: 1;">
                ${header.mainTitle}
              </div>
              <div style="font-size: 16px; font-weight: normal; background: #3b82f6; padding: 8px 16px; border-radius: 20px; display: inline-block;">
                ${header.subtitle}
              </div>
            </div>
            ${avatarUrl ? `
              <div style="margin-left: 24px;">
                <img src="${avatarUrl}" alt="Profile" style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid white; object-fit: cover;" />
              </div>
            ` : ''}
          </div>

          <!-- Content Section -->
          <div style="flex: 1; padding: 24px; background: #f9fafb; overflow-y: auto;">
            ${contentHTML}
          </div>

          <!-- Footer Section -->
          <div style="background: #1f2937; color: white; padding: 16px; display: flex; align-items: center;">
            <div style="width: 48px; height: 48px; background: #4b5563; border-radius: 50%; margin-right: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${avatarUrl ? `
                <img src="${avatarUrl}" alt="Profile" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />
              ` : `
                <span style="font-size: 18px; font-weight: bold;">${fullName[0] || 'U'}</span>
              `}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: bold; font-size: 18px;">${fullName}</div>
              <div style="color: #d1d5db; font-size: 14px;">${company}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 18px;">${footer.brand || 'ENGINEERED VISION'}</div>
              <div style="color: #d1d5db; font-size: 12px;">${footer.tagline || 'INNOVATION THAT MATTERS'}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}