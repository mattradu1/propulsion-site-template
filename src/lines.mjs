// Approved template lines (v4; v3 added the four before/after lines, v4 adds the action bar, form, rating and demo lines). The only visible words the template may write itself.
// Everything else on a page comes from client.json. Any key under client.json "copy" overrides
// the line here; a missing optional section is left out rather than filled with made-up words.
// The output guard "Copy traceability" fails any visible text that is in neither place.

export const LINES = {
  skip: 'Skip to content',
  menu: 'Menu',
  close: 'Close',
  navWork: { we: 'Our work', I: 'My work' },
  navAbout: { we: 'About us', I: 'About me' },
  navIdeas: 'Ideas',
  navServices: 'Services',
  ctaLabel: 'Start your enquiry',
  call: 'Call',
  day: 'Day',
  evening: 'Evening',
  lightingGroup: 'Lighting',
  workHeading: { we: 'Our work', I: 'My work' },
  baHeading: 'Before and after',
  before: 'Before',
  after: 'After',
  baSlider: 'Before and after: move to compare',
  seeAllWork: { we: 'See all our work', I: 'See all my work' },
  processHeading: 'How a job runs',
  ownerHeading: "Who you'll be dealing with",
  aboutLink: { we: 'About us', I: 'About me' },
  reviewsHeading: 'What customers say',
  reviewSource: 'Read the review',
  allReviews: 'See all reviews on Google',
  areasHeading: { we: 'Areas we cover', I: 'Areas I cover' },
  servicesHeading: { we: 'What we do', I: 'What I do' },
  allServices: 'All services',
  ctaHeading: { we: 'Tell us about the job', I: 'Tell me about the job' },
  ctaText: { we: 'Answer a few short questions and we will get back to you.', I: 'Answer a few short questions and I will get back to you.' },
  formHeading: 'Or send a message',
  formName: 'Name',
  formPhone: 'Phone',
  formEmail: 'Email',
  formMessage: 'About the job',
  formSend: 'Send enquiry',
  formPreviewStrong: 'This is a preview.',
  formPreviewNote: 'Messages from this form go to a Propulsion test inbox, not to the business.',
  privacy: 'Privacy notice',
  explore: 'Explore',
  contact: 'Contact',
  whereWeWork: { we: 'Where we work', I: 'Where I work' },
  companyNumber: 'Company number',
  registeredOffice: 'Registered office',
  supplierImage: 'Supplier image',
  ideasH1: 'Ideas',
  aboutH1: { we: 'About us', I: 'About me' },
  servicesH1: 'Services',
  lastUpdated: 'Last updated',
  notFoundH1: 'Page not found',
  notFoundText: "The page you were looking for isn't here.",
  goHome: 'Go to the home page',
  previewStrong: 'Preview – not live.',
  previewText: 'This site is not public yet and is hidden from search engines.',
  demoFlag: 'DEMO: a fictional business built to test the Propulsion template. Not a real company, phone number, address or reviews.',
  // v4 (need Matt's approval): phone action bar, form validation and success, review rating, sales demo mode.
  barLabel: 'Quick contact',
  barEnquire: 'Enquire',
  whatsapp: 'WhatsApp',
  formErrName: 'Add your name.',
  formErrEmail: 'Add an email address to reply to.',
  formErrEmailBad: 'Check the email address.',
  formErrPhone: 'Check the phone number.',
  formErrConsent: { we: 'Tick the box so we can reply.', I: 'Tick the box so I can reply.' },
  formSent: 'Thank you. Your enquiry has been sent.',
  rating: 'Rated N out of 5', // N is the review's own rating from client.json (1–5); rendered as screen-reader text
  demoRibbon: 'DEMO — example site',
  demoTrades: 'Other example trades',
  internalRef: 'INTERNAL REFERENCE – NOT FOR PUBLICATION',
  internalRefNote: 'Rebuilt through the Propulsion template for comparison only. Items marked as being confirmed are open conflicts, not chosen values.',
};

// Approved neutral lines for items waiting on the client (engine rulebook S5, r6).
export const NEUTRAL = {
  'ICO number': { we: 'Our ICO registration details are being confirmed. Contact us if you need them.', I: 'My ICO registration details are being confirmed. Contact me if you need them.' },
  default: { we: 'Being confirmed. Please contact us for details.', I: 'Being confirmed. Please contact me for details.' },
};

export const line = (cfg, key) => {
  const o = cfg.copy?.[key];
  if (typeof o === 'string' || (o && typeof o === 'object' && typeof o.pending === 'string')) return o;
  const v = LINES[key];
  if (v == null) throw new Error(`No approved line "${key}"`);
  return typeof v === 'string' ? v : v[cfg.voice];
};

export const neutral = (cfg, item) => (NEUTRAL[item] || NEUTRAL.default)[cfg.voice];

// Every approved string in both voices (used by the traceability guard).
export function approvedStrings() {
  const out = new Set();
  for (const v of [...Object.values(LINES), ...Object.values(NEUTRAL)]) {
    if (typeof v === 'string') out.add(v); else Object.values(v).forEach((x) => out.add(x));
  }
  return out;
}
