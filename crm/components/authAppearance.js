// The engine's register, applied to Clerk's forms.
//
// Clerk's default card is a rounded, shadowed widget that reads as "embedded third-party
// thing". Here the card chrome is stripped so the page provides the frame, and every
// control is pulled onto the same rules as the rest of the app: square corners, hairline
// borders, black as the one primary action, tracked caps for labels, tabular figures for
// the code field. See docs/BRAND.md — nothing shrinks, contrast only goes up.

const INK = '#1a1a18';
const PAPER = '#f7f7f4';
const HAIR = '#e3e3dd';
const MUTE = '#73736c';
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const authAppearance = {
  variables: {
    colorPrimary: INK,
    colorText: INK,
    colorTextSecondary: MUTE,
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: INK,
    colorDanger: '#c02d23',
    colorSuccess: '#35804a',
    borderRadius: '2px',
    fontFamily: SANS,
    fontSize: '14px',
    spacingUnit: '1rem',
  },
  elements: {
    // the page supplies the frame; Clerk shouldn't draw a competing one
    rootBox: { width: '100%' },
    cardBox: { boxShadow: 'none', border: 'none', width: '100%' },
    card: {
      boxShadow: 'none',
      border: `1px solid ${HAIR}`,
      borderRadius: '2px',
      background: '#fff',
      padding: '30px 30px 26px',
      width: '100%',
    },
    // The frame above already says Chase Contemporary — Clerk repeating it reads as a
    // stutter, so its header is hidden and the card starts at the field.
    header: { display: 'none' },
    // and the vendor badge doesn't belong on the gallery's own sign-in
    footer: { display: 'none' },

    // fields
    formFieldLabel: {
      fontSize: '11px', fontWeight: 650, letterSpacing: '.07em',
      textTransform: 'uppercase', color: MUTE, marginBottom: '6px',
    },
    formFieldInput: {
      height: '38px', borderRadius: '2px', border: `1px solid ${HAIR}`,
      fontSize: '14px', color: INK, boxShadow: 'none',
      '&:focus': { border: `1px solid ${INK}`, boxShadow: '0 0 0 3px rgba(26,26,24,.08)' },
    },
    formFieldInputShowPasswordButton: { color: MUTE },
    formFieldHintText: { fontSize: '12.5px', color: MUTE },
    formFieldErrorText: { fontSize: '12.5px', color: '#c02d23', fontWeight: 500 },

    // black is the one primary action, everywhere in the app
    formButtonPrimary: {
      background: INK, color: '#fff', borderRadius: '2px', height: '38px',
      fontSize: '13px', fontWeight: 600, letterSpacing: '.02em', textTransform: 'none',
      boxShadow: 'none', border: 0,
      '&:hover': { background: '#000' },
      '&:focus': { boxShadow: '0 0 0 3px rgba(26,26,24,.15)' },
    },
    formButtonReset: { color: MUTE, fontSize: '13px' },

    // the one-time code field reads as numerals, not text
    otpCodeFieldInput: {
      borderRadius: '2px', border: `1px solid ${HAIR}`, fontSize: '17px',
      fontVariantNumeric: 'tabular-nums', color: INK,
      '&:focus': { border: `1px solid ${INK}`, boxShadow: '0 0 0 3px rgba(26,26,24,.08)' },
    },
    formResendCodeLink: { color: '#2257c5', fontSize: '12.5px', fontWeight: 600 },

    // Google is enabled on the production instance but has no OAuth credentials of its
    // own — Clerk only lends shared ones in development — so the button leads to Google's
    // "Missing required parameter: client_id" error. Hidden until it is either configured
    // with real credentials or turned off in the dashboard.
    socialButtons: { display: 'none' },
    dividerRow: { display: 'none' },
    socialButtonsBlockButton: {
      borderRadius: '2px', border: `1px solid ${HAIR}`, height: '38px',
      fontSize: '13px', color: INK, background: '#fff',
      '&:hover': { background: PAPER },
    },
    dividerLine: { background: HAIR },
    dividerText: {
      fontSize: '10.5px', fontWeight: 650, letterSpacing: '.08em',
      textTransform: 'uppercase', color: MUTE,
    },

    identityPreview: { borderRadius: '2px', border: `1px solid ${HAIR}`, background: PAPER },
    identityPreviewText: { fontSize: '13px', color: INK },
    identityPreviewEditButton: { color: '#2257c5' },

    alternativeMethodsBlockButton: {
      borderRadius: '2px', border: `1px solid ${HAIR}`, height: '38px',
      fontSize: '13px', color: INK,
      '&:hover': { background: PAPER },
    },

    footerAction: { background: 'transparent' },
    footerActionText: { fontSize: '12.5px', color: MUTE },
    footerActionLink: {
      fontSize: '12.5px', color: '#2257c5', fontWeight: 600, textDecoration: 'none',
      '&:hover': { textDecoration: 'underline' },
    },
    // Clerk's development-mode badge would sit on the gallery's own page
    logoBox: { display: 'none' },
  },
  layout: { showOptionalFields: false },
};
