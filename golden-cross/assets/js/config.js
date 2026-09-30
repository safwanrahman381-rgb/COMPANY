/* ==========================================================================
   SITE CONFIG — edit this file, not main.js.
   Anything marked TODO must be confirmed with the owner before launch.
   ========================================================================== */
window.GC_CONFIG = {
  name: "The Golden Cross",
  phoneDisplay: "01743 362507",
  phoneTel: "+441743362507",
  email: "hello@goldencrosshotel.co.uk", // TODO: confirm real inbox
  address: "14 Princess Street, Shrewsbury, SY1 1LP",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=The+Golden+Cross+14+Princess+St+Shrewsbury+SY1+1LP",
  mapsEmbed: "https://www.google.com/maps?q=The+Golden+Cross,+14+Princess+St,+Shrewsbury+SY1+1LP&output=embed",
  reviewsUrl: "https://www.google.com/maps/search/?api=1&query=The+Golden+Cross+Shrewsbury",

  /* Booking/enquiry form endpoint.
     Paste a Formspree / Basin / Getform / your own endpoint URL here
     (it must accept a POST of form data and return 2xx).
     Left empty, the form falls back to opening the guest's email app
     with the enquiry pre-filled, so nothing is ever lost. */
  formEndpoint: "",

  /* Opening hours. TODO: confirm with the owner.
     While this is null the site shows "call to check" instead of guessing.
     Format when known (24h, one or more ranges per day, [] = closed):
     hours: {
       mon: [], tue: [["12:00","14:30"],["18:00","21:00"]], wed: ..., thu: ..., fri: ..., sat: ..., sun: ...
     } */
  hours: null,

  /* Optional analytics (e.g. Plausible, GA4). Only loaded AFTER the visitor
     opts in to "Analytics" cookies. Leave empty to load nothing. */
  analytics: {
    ga4Id: "" // e.g. "G-XXXXXXX"
  }
};
