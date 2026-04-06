const DESIGN_TYPES = {
  'logo-brand': {
    name: 'Logo & Brand Identity',
    keywords: [
      'logo', 'brand identity', 'brand mark', 'company logo',
      'branding', 'icon design', 'mark', 'emblem'
    ],
    defaultAspectRatio: '1:1',
    guidelines: {
      composition: 'Clean, modern logo with icon and text. Centered, balanced layout. Professional brand identity.',
      typography: 'Bold, modern sans-serif or elegant serif. Sharp, crisp letterforms. Professional kerning.',
      visual_elements: 'Abstract geometric symbol or memorable icon. Could incorporate industry elements.',
      colors: 'Professional palette (deep blue #1E3A8A, tech purple #6366F1, or brand colors). High contrast.',
      technical: 'Clean edges, scalable design, works on light and dark backgrounds. Suitable for business cards, websites, app icons.'
    },
    promptTemplate: `Create a modern, professional logo.

DESIGN STYLE:
- Clean, minimalist, contemporary aesthetic
- Professional brand identity suitable for business use

TYPOGRAPHY:
- {{text}} in uppercase letters
- Bold, modern font with perfect spacing
- Professional kerning and alignment

VISUAL ELEMENTS:
- Abstract geometric symbol or memorable icon
- Icon and text balanced composition
- Works standalone

COLOR SCHEME:
- {{colors}} with high contrast
- Modern professional palette
- Versatile for various backgrounds

TECHNICAL REQUIREMENTS:
- Clean edges and sharp details
- Scalable design (works at any size)
- Professional quality

The logo should be clean, memorable, and suitable for professional use.`
  },

  'social-media': {
    name: 'Social Media Graphics',
    keywords: [
      'instagram', 'social media', 'post', 'story', 'facebook',
      'twitter', 'tiktok', 'social graphic', 'feed post'
    ],
    defaultAspectRatio: '1:1',
    guidelines: {
      composition: 'Square or vertical format. Centered, balanced layout. Breathing room with negative space.',
      style: 'Modern minimalist, clean and elegant, professional',
      imagery: 'High-quality photography or clean graphics. Professional studio quality.',
      text: 'Bold headline with supporting tagline. Professional typography hierarchy.',
      colors: 'Brand-consistent palette. Professional color harmony.',
      technical: 'Instagram-optimized (1080×1080 or 1080×1920). 2K resolution.'
    },
    promptTemplate: `Create a professional social media graphic.

COMPOSITION:
- {{aspect_ratio}} format (Instagram/platform optimized)
- Centered, balanced layout
- Professional aesthetic with breathing room

VISUAL STYLE:
- Modern minimalist design
- Clean and elegant
- Professional quality

IMAGERY:
- {{subject}} with professional styling
- High-quality photography or graphics
- Clean presentation

TEXT (if applicable):
- Bold headline: "{{headline}}"
- Professional typography
- Readable and eye-catching

COLOR PALETTE:
- {{colors}}
- Professional color harmony
- Platform-appropriate

The image should be shareable, professional, and platform-optimized.`
  },

  'product-design': {
    name: 'Product Design',
    keywords: [
      'product', 'mockup', 'packaging', 'product photo',
      'commercial photography', 'product shot', 'e-commerce'
    ],
    defaultAspectRatio: '2:3',
    guidelines: {
      composition: 'Product elegantly positioned. Clean background. Professional studio setup.',
      product: 'Modern, sleek design. Premium materials. Professional camera quality.',
      lighting: 'High-end commercial photography. Soft, even studio lighting. Rich colors.',
      background: 'Pure white, soft gradient, or minimal texture. Professional presentation.',
      mood: 'Premium and luxurious. High-end and sophisticated.'
    },
    promptTemplate: `Create premium product photography.

COMPOSITION:
- Product elegantly positioned with packaging
- Clean, minimalist background
- Professional studio setup

PRODUCT DETAILS:
- {{product_description}}
- Premium materials and finishes
- Professional camera quality
- Bright, appealing presentation

LIGHTING & STYLE:
- High-end commercial photography
- Soft, even studio lighting
- Professional depth and dimension
- Rich colors and sharp details

BACKGROUND:
- {{background_color or "pure white"}}
- Clean and professional
- Draws focus to product

The image should look like professional luxury product photography suitable for e-commerce or marketing.`
  },

  'editorial-design': {
    name: 'Editorial Design',
    keywords: [
      'magazine', 'editorial', 'cover', 'magazine cover',
      'publication', 'article', 'food magazine', 'fashion editorial'
    ],
    defaultAspectRatio: '3:4',
    guidelines: {
      composition: 'Vertical magazine layout. Professional editorial quality. Clear focal point.',
      style: 'High-end photography. Rich, vibrant colors. Magazine-quality composition.',
      headline: 'Bold, modern typography. Eye-catching and readable. Strong contrast.',
      elements: 'Professional layout. Balance between text and imagery.',
      colors: 'Professional editorial colors. Color grading that enhances appeal.'
    },
    promptTemplate: `Create a professional magazine cover.

COMPOSITION:
- Vertical magazine layout (3:4 or 9:16)
- Professional editorial quality
- Balanced composition with clear focal point

VISUAL STYLE:
- High-end photography
- Rich, vibrant colors
- Professional lighting and depth
- Magazine-quality

IMAGERY:
- {{subject}} with professional styling
- Clean, elegant presentation
- High detail and texture

HEADLINE:
- "{{title}}" in bold, modern typography
- Eye-catching and readable
- Professional editorial font
- Strong contrast against background

DESIGN ELEMENTS:
- Professional color scheme
- Clean typography hierarchy
- Magazine-quality layout

The cover should be magazine-ready with professional photography and sophisticated typography.`
  },

  'web-ui': {
    name: 'Web & UI/UX Design',
    keywords: [
      'website', 'landing page', 'hero section', 'web design',
      'ui design', 'interface', 'dashboard', 'app design'
    ],
    defaultAspectRatio: '16:9',
    guidelines: {
      layout: 'Horizontal hero banner. Left: text (60%), Right: visual (40%).',
      style: 'Modern, professional, tech-forward. Clean and minimalist.',
      content: 'Headline, subheading, CTA button. Professional UI/UX design.',
      visuals: 'Abstract tech background or product mockup. Professional color scheme.',
      colors: 'Professional tech colors. High contrast for readability.'
    },
    promptTemplate: `Create a professional landing page hero section.

LAYOUT:
- Horizontal hero banner (16:9)
- Left side: Text content area (60%)
- Right side: {{visual_type or "product visualization"}} (40%)
- Professional UI/UX design

DESIGN STYLE:
- Modern, professional, tech-forward
- Clean and minimalist
- High-tech aesthetic

CONTENT STRUCTURE:
- Headline: "{{headline}}"
  * Bold, modern font
  * Large and impactful

- Subheading: "{{subheading or "Supporting information"}}"
  * Smaller, lighter weight

- Call-to-Action: "{{cta or "Get Started"}}" button
  * Prominent, contrasting color

VISUALS:
- {{visual_description or "Abstract tech background or product mockup"}}
- Clean, modern aesthetic
- Professional color scheme

BACKGROUND:
- Smooth gradient or solid color
- Modern tech aesthetic
- Doesn't distract from content

The design should be suitable for a modern SaaS/tech landing page with professional UI/UX.`
  },

  'fashion-lifestyle': {
    name: 'Fashion & Lifestyle',
    keywords: [
      'fashion', 'model', 'clothing', 'lifestyle',
      'editorial photo', 'fashion shoot', 'apparel'
    ],
    defaultAspectRatio: '2:3',
    guidelines: {
      composition: 'Elegant pose. Clean, minimalist background. Vertical format.',
      model: 'Sophisticated fashion model. Natural expression. Professional styling.',
      styling: 'High-quality garments. Professional fashion photography quality.',
      lighting: 'High-end fashion photography lighting. Soft, even illumination. Professional retouching.',
      mood: 'Elegant and sophisticated. High-end fashion editorial.'
    },
    promptTemplate: `Create a professional fashion editorial photograph.

COMPOSITION:
- Elegant, sophisticated pose
- Clean, minimalist background
- Professional fashion photography
- Vertical format (2:3 or 4:5)

MODEL & STYLING:
- Sophisticated fashion model
- {{clothing_description}}
- Natural, elegant expression
- Professional styling and makeup

GARMENT DETAILS:
- {{garment_type}} with high-quality fabric
- Sophisticated silhouette
- Professional fashion photography quality

LIGHTING & STYLE:
- High-end fashion photography lighting
- Soft, even illumination
- Professional depth and dimension
- Clean, modern aesthetic
- Professional retouching quality

BACKGROUND:
- Clean, minimalist background
- {{background_color or "white/soft grey"}}
- Draws focus to model and clothing

The image should look like a professional fashion editorial from a high-end magazine.`
  },

  'architectural': {
    name: 'Architectural & Interior',
    keywords: [
      'architecture', 'house', 'building', 'interior',
      'room', 'architectural', 'modern house', 'design space'
    ],
    defaultAspectRatio: '16:9',
    guidelines: {
      style: 'Contemporary/modern design. Clean lines and geometric shapes.',
      features: 'Large windows, neutral colors, professional landscaping.',
      lighting: 'Natural daylight (golden hour or midday). Soft shadows. Warm atmosphere.',
      materials: 'Modern materials (concrete, glass, metal, wood). High-quality finishes.',
      viewpoint: 'Slightly elevated 3/4 view. Professional photography angle.'
    },
    promptTemplate: `Create a professional architectural visualization.

ARCHITECTURAL STYLE:
- {{style or "Contemporary/modern"}} design
- Clean lines and geometric shapes
- Minimalist aesthetic
- Professional architectural rendering

FEATURES:
- {{building_type}} with clean facade
- Large floor-to-ceiling glass windows
- Neutral color palette (white, grey, natural wood)
- Professional landscaping with plants

LIGHTING & ATMOSPHERE:
- Natural daylight ({{lighting or "golden hour"}})
- Soft shadows and highlights
- Professional architectural photography
- Warm, inviting lighting

MATERIALS:
- Modern materials (concrete, glass, metal, wood)
- High-quality finishes
- Clean surfaces and textures

VIEWPOINT:
- Slightly elevated angle (3/4 view)
- Shows full structure and surroundings
- Professional architectural photography angle

The visualization should look like professional architectural photography suitable for real estate marketing.`
  },

  'abstract-artistic': {
    name: 'Abstract & Artistic',
    keywords: [
      'abstract', 'art', 'painting', 'artistic',
      'contemporary art', 'modern art', 'geometric art'
    ],
    defaultAspectRatio: '1:1',
    guidelines: {
      style: 'Contemporary abstract art. Modern and expressive. Gallery quality.',
      colors: 'Vibrant, saturated colors. Bold combinations. High contrast.',
      composition: 'Geometric shapes. Overlapping elements. Dynamic arrangement.',
      texture: 'Smooth surfaces or subtle texture. Soft gradients or hard edges.',
      mood: 'Energetic and vibrant. Modern and contemporary. Gallery-quality.'
    },
    promptTemplate: `Create an abstract painting.

ART STYLE:
- Contemporary abstract art
- Modern and expressive
- Professional gallery quality
- Dynamic and energetic

COLOR PALETTE:
- {{colors or "Vibrant, saturated colors"}}
- Bold combinations
- High contrast and saturation
- Professional color harmony

COMPOSITION:
- Geometric shapes ({{shapes or "circles, triangles, rectangles"}})
- Overlapping and layered elements
- Dynamic, asymmetrical arrangement
- Balance of positive and negative space

TEXTURE & EFFECTS:
- Smooth surfaces or subtle texture
- {{texture_type or "Clean, modern finish"}}
- Professional painting technique
- Gallery-quality finish

The artwork should look like a professional contemporary abstract painting suitable for art galleries.`
  },

  'technical-scientific': {
    name: 'Technical & Scientific',
    keywords: [
      'diagram', 'technical', 'infographic', 'chart',
      'scientific', 'illustration', 'technical drawing'
    ],
    defaultAspectRatio: '16:9',
    guidelines: {
      style: 'Technical illustration. Clean, educational. Information design.',
      content: 'Clear components with labels. Organized flow and hierarchy.',
      visual: 'Clean technical illustration. Professional diagram design.',
      colors: 'Professional technical colors. Blues, whites, greys. High contrast.',
      annotations: 'Clear labels. Professional typography. Educational.'
    },
    promptTemplate: `Create a professional technical diagram.

STYLE:
- Technical illustration and diagram
- Clean, educational, professional
- Information design and visualization

CONTENT & COMPONENTS:
- {{subject}} with key components labeled
- Clear structure and organization
- Professional technical accuracy

VISUAL STYLE:
- Clean technical illustration
- Professional diagram design
- Clear labels and annotations
- Organized flow and hierarchy
- Modern, professional aesthetic

LAYOUT:
- Centralized diagram with organized sections
- Clear flow and connections (arrows or lines)
- Professional information design
- Balanced composition

COLOR SCHEME:
- Professional technical colors
- {{colors or "Blues, whites, and greys"}}
- Clear color coding for components
- High contrast for readability

ANNOTATIONS:
- Clear labels for each component
- Professional typography
- Arrows showing data flow
- Educational and informative

The diagram should be clear, professional, and suitable for technical documentation or educational materials.`
  },

  'event-invitation': {
    name: 'Event & Invitation Design',
    keywords: [
      'invitation', 'wedding', 'event', 'card',
      'invite', 'party invitation', 'celebration'
    ],
    defaultAspectRatio: '4:5',
    guidelines: {
      composition: 'Vertical invitation format. Centered, symmetrical. Professional typography.',
      style: 'Elegant and sophisticated. Professional invitation design.',
      elements: 'Decorative borders, floral motifs, elegant flourishes.',
      typography: 'Elegant script or serif fonts. Professional hierarchy.',
      colors: 'Luxurious colors (gold, white, cream). Elegant harmony.'
    },
    promptTemplate: `Create an elegant invitation.

COMPOSITION:
- Vertical invitation format (4:5 or 2:3)
- Centered, symmetrical layout
- Professional typography hierarchy

DESIGN STYLE:
- Elegant and sophisticated
- {{theme or "Romantic and timeless"}}
- Professional invitation design

VISUAL ELEMENTS:
- Decorative borders or frames ({{accent_color or "gold"}})
- {{decorative_elements or "Floral motifs or ornamental patterns"}}
- Elegant flourishes or divider lines

TEXT STRUCTURE:
- Names: "{{names}}"
  * Large, elegant typography
  * Beautiful script or elegant serif

- Date & Time: "{{date_time}}"
  * Clean, readable font

- Venue: "{{venue}}"
  * Supporting typography

COLOR PALETTE:
- {{colors or "Luxurious gold and clean white"}}
- Elegant, timeless color harmony
- High-end aesthetic

The invitation should be print-ready and suitable for both physical cards and digital sharing.`
  },

  'infographic': {
    name: 'Infographic Design',
    keywords: [
      'infographic', 'data visualization', 'statistics',
      'chart', 'data', 'info graphic', 'visual data'
    ],
    defaultAspectRatio: '9:16',
    guidelines: {
      layout: 'Vertical scroll-friendly. Clear sections with hierarchy.',
      style: 'Modern, clean. Data visualization focused. Educational.',
      elements: 'Bar charts, pie charts, icons, number callouts.',
      typography: 'Clear, readable. Bold numbers. Professional hierarchy.',
      colors: 'Professional data viz colors. High contrast.'
    },
    promptTemplate: `Create a professional infographic.

LAYOUT:
- Vertical scroll-friendly layout (9:16)
- Clear sections with visual hierarchy
- Header → Data sections → Conclusion
- Professional information design

HEADER:
- Title: "{{title}}"
  * Bold, large, eye-catching
- Subtitle: "{{subtitle}}"
  * Supporting text

DESIGN STYLE:
- Modern, clean, professional
- Data visualization focused
- Easy to read and understand
- Educational and informative

DATA VISUALIZATION:
- {{data_type}} charts or graphs
- {{key_statistics}}
- Icons and illustrations
- Number callouts with large, bold typography

CONTENT STRUCTURE:
1. Header with main statistic
2. 3-5 key data points with visualizations
3. Supporting text
4. Icons and visual aids
5. Sources/credits at bottom

COLOR PALETTE:
- Professional data viz colors
- {{colors or "Blues and greens for the theme"}}
- High contrast for readability
- Color coding for categories

The infographic should be shareable on social media and suitable for presentations.`
  },

  'book-album-cover': {
    name: 'Book & Album Cover Design',
    keywords: [
      'book cover', 'album cover', 'book', 'album',
      'cover design', 'music cover', 'novel cover'
    ],
    defaultAspectRatio: '2:3',
    guidelines: {
      composition: 'Vertical cover format (2:3 for books, 1:1 for albums).',
      style: 'Genre-appropriate aesthetic. Professional publishing quality.',
      title: 'Bold typography. Large, readable from thumbnail. High contrast.',
      imagery: 'Genre-appropriate visuals. Professional photography or illustration.',
      colors: 'Genre-appropriate palette. Professional, sophisticated.'
    },
    promptTemplate: `Create a professional {{cover_type or "book"}} cover.

COMPOSITION:
- {{aspect_ratio or "Vertical"}} cover format
- Professional publishing quality
- Clear visual hierarchy

DESIGN STYLE:
- {{genre or "Genre-appropriate"}} aesthetic
- Professional {{cover_type or "book"}} cover design
- Commercial quality

IMAGERY:
- {{imagery_description}}
- Professional photography or illustration
- Genre-appropriate visual language

TITLE:
- "{{title}}" in bold, impactful typography
  * Large, readable from thumbnail
  * {{genre}}-appropriate font
  * High contrast
  * Positioned prominently

AUTHOR/ARTIST:
- "{{author or "by Author Name"}}"
  * Smaller but clearly visible
  * Professional typography

COLOR PALETTE:
- {{colors or "Genre-appropriate colors"}}
- High contrast for readability
- Professional, sophisticated palette

The cover should be eye-catching at thumbnail size and professional enough for commercial publishing/release.`
  },

  'character-mascot': {
    name: 'Character & Mascot Design',
    keywords: [
      'character', 'mascot', 'cartoon character', 'brand mascot',
      'character design', 'app mascot', 'logo character'
    ],
    defaultAspectRatio: '1:1',
    guidelines: {
      type: 'Cute, friendly cartoon character. Professional character design.',
      options: 'Anthropomorphic animal, fantasy creature, or human character.',
      personality: 'Friendly expression, smart appearance, energetic.',
      style: 'Modern cartoon/vector style. Clean, simple shapes. Scalable.',
      colors: 'Bright, friendly colors. Professional color harmony.'
    },
    promptTemplate: `Create a friendly mascot character.

CHARACTER TYPE:
- Cute, friendly cartoon character
- {{character_type or "Anthropomorphic animal or friendly creature"}}
- Professional character design
- Age-appropriate and memorable

CHARACTER DESCRIPTION:
- {{description}}
- Big, friendly eyes
- Smiling, happy expression
- Rounded, soft shapes

PERSONALITY TRAITS:
- Friendly, welcoming expression
  * Big smile
  * Warm, inviting eyes

- Smart, helpful appearance
  * {{accessories or "Optional glasses, backpack, or props"}}

- Energetic and encouraging
  * Dynamic pose
  * Positive body language

DESIGN STYLE:
- Modern cartoon/vector style
- Clean, simple shapes
- Professional character design
- Scalable and versatile

COLOR PALETTE:
- {{colors or "Bright, friendly colors"}}
- High saturation
- Professional color harmony
- Brand-appropriate

BACKGROUND:
- Clean, simple background
- White or light colored
- Professional presentation

The mascot should be friendly, memorable, professional, and suitable for {{use_case or "brand identity"}}.`
  }
};

// Helper function to detect design type from user message
function detectDesignType(message, selectedShapes = []) {
  const lowerMessage = message.toLowerCase();

  // Check each design type's keywords
  for (const [typeId, typeData] of Object.entries(DESIGN_TYPES)) {
    const matches = typeData.keywords.some(keyword =>
      lowerMessage.includes(keyword)
    );

    if (matches) {
      return {
        id: typeId,
        ...typeData
      };
    }
  }

  // Default: no specific type detected
  return null;
}

// Helper function to fill template with user data
function fillPromptTemplate(template, data) {
  let filledTemplate = template;

  // Replace all {{variable}} placeholders with actual data
  const matches = template.match(/\{\{([^}]+)\}\}/g);
  if (matches) {
    matches.forEach(match => {
      const key = match.slice(2, -2).trim();
      const value = data[key] || match; // Keep placeholder if no data
      filledTemplate = filledTemplate.replace(match, value);
    });
  }

  return filledTemplate;
}

module.exports = {
  DESIGN_TYPES,
  detectDesignType,
  fillPromptTemplate
};
