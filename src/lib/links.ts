// Guide links, checked 21 Sep 2026. police.uk and both force sites sit behind a
// Cloudflare human check, so an automated link-checker gets 403 from them. Those
// were confirmed through their latest Wayback Machine captures; everything else
// returned 200 live. #knifefree (now a parked domain) and BikeRegister (couldn't
// be verified) are deliberately not linked.
export type GuideLink = { url: string; title: string; blurb: string; source: string };

const L = (source: string, title: string, url: string, blurb: string): GuideLink => ({ source, title, url, blurb });

export const LINKS: {
  categories: Partial<Record<string, GuideLink[]>>;
  general: Record<string, GuideLink>;
  students: GuideLink[];
  reporting: GuideLink[];
} = {
  categories: {
    "violent-crime": [
      L("Police.uk", "Rape and sexual offences: information and advice", "https://www.police.uk/pu/contact-us/rape-sexual-assault-or-another-sexual-offence/get-information-and-advice-about-rape-sexual-offences/", "Ways to report, including online, and where to find support."),
      L("Police.uk", "Spiking", "https://www.police.uk/advice/advice-and-information/spiking-advice/spiking/", "What spiking is, the signs, and how to report it."),
      L("Victim Support", "Violent crime", "https://www.victimsupport.org.uk/crime-info/types-crime/violent-crime/", "Support and next steps after an assault."),
      L("Rape Crisis England & Wales", "Get help after rape or sexual assault", "https://rapecrisis.org.uk/get-help/", "Specialist helpline, live chat and local centres, however long ago it happened."),
    ],
    robbery: [
      L("West Midlands Police", "How to protect yourself from street robbery", "https://www.westmidlands.police.uk/cp/crime-prevention/personal-safety-how-to-stay-safe/mugging-street-robbery/", "Route planning, awareness and keeping valuables out of sight."),
      L("Crimestoppers", "Theft and robbery", "https://crimestoppers-uk.org/keeping-safe/personal-safety/theft-and-robbery", "Keeping phones, bags and wallets away from thieves."),
      L("Victim Support", "Robbery", "https://www.victimsupport.org.uk/crime-info/types-crime/robbery/", "Coping after a robbery, and free confidential support."),
    ],
    "theft-from-the-person": [
      L("West Midlands Police", "Protect your phone from thieves on bikes and mopeds", "https://www.westmidlands.police.uk/cp/crime-prevention/personal-safety-how-to-stay-safe/protect-your-mobile-phone-against-criminals-on-bikes-and-mopeds/", "How snatch thieves work and how to avoid them."),
      L("Warwickshire Police", "Protect your phone", "https://www.warwickshire.police.uk/cp/crime-prevention/personal-safety-how-to-stay-safe/mobile-phone-advice/", "Settings that make a stolen phone traceable and useless."),
      L("Immobilise", "Smartphone registration and reporting", "https://www.immobilise.com/articles/smartphone-registration-and-reporting", "Register your IMEI so police can identify a recovered phone."),
      L("Neighbourhood Watch", "Mobile phone theft", "https://www.ourwatch.org.uk/crime-prevention/crime-types/mobile-phone-theft", "Trends, prevention and what to do if it's taken."),
    ],
    "public-order": [
      L("West Midlands Police", "Staying safe when you're out and about", "https://www.westmidlands.police.uk/police-forces/west-midlands-police/areas/campaigns/campaigns/staying-safe/", "Advice for staying safe in public and on nights out."),
      L("Police.uk", "Hate crime", "https://www.police.uk/pu/contact-us/hate-crime/", "Recognise, report and get support for hate crimes and incidents."),
      L("Neighbourhood Watch", "Being an active bystander", "https://www.ourwatch.org.uk/activebystander", "Safe ways to step in when you see harassment or aggression."),
      L("Crown Prosecution Service", "Public order offences", "https://www.cps.gov.uk/prosecution-guidance/public-order-offences-incorporating-charging-standard", "The legal definitions of affray, threatening behaviour and more."),
    ],
    "possession-of-weapons": [
      L("Police.uk", "Possession of weapons", "https://www.police.uk/pu/services-information/possession-of-weapons/", "Knife and weapon law in plain English."),
      L("GOV.UK", "Selling, buying and carrying knives", "https://www.gov.uk/buying-carrying-knives", "Which knives are legal to carry, banned weapons and penalties."),
      L("West Midlands Police", "LifeOrKnife", "https://www.westmidlands.police.uk/police-forces/west-midlands-police/areas/campaigns/campaigns/lifeorknife/", "Local campaign, including anonymous knife surrender bins."),
      L("Crimestoppers", "Understanding knife crime", "https://crimestoppers-uk.org/fearless/more-info/crime-types-explained/knife-crime", "Facts on knife crime and how to report it anonymously."),
    ],
    burglary: [
      L("Police.uk", "Keep burglars out of your property", "https://www.police.uk/cp/crime-prevention/protect-home-crime/keep-burglars-out-property/", "How burglars choose homes, and simple ways to put them off."),
      L("Police.uk", "How safe is your flat?", "https://www.police.uk/cp/crime-prevention/protect-home-crime/how-safe-is-your-flat/", "Shared blocks: communal doors, tailgating and flat security."),
      L("Immobilise", "Keeping your student digs and gear secure", "https://www.immobilise.com/articles/how-to-keep-your-student-digs-and-gear-secure", "Protecting laptops, phones and belongings in a shared house."),
      L("Victim Support", "Burglary", "https://www.victimsupport.org.uk/crime-info/types-crime/burglary/", "What to do after a break-in, and support if it shakes you."),
    ],
    "vehicle-crime": [
      L("Police.uk", "Preventing car and vehicle theft", "https://www.police.uk/cp/crime-prevention/keeping-vehicles-safe/preventing-car-vehicle-theft/", "Simple rules that stop your car being stolen."),
      L("Police.uk", "Prevent theft from a vehicle", "https://www.police.uk/cp/crime-prevention/keeping-vehicles-safe/vehicle-safe-and-sound/", "Stop break-ins by leaving nothing on show."),
      L("Police.uk", "Protect your motorcycle, moped or scooter", "https://www.police.uk/cp/crime-prevention/keeping-vehicles-safe/theft-motorcycles-scooters/", "Locking, chaining and covering two-wheelers."),
      L("GOV.UK", "What to do if your vehicle is stolen", "https://www.gov.uk/what-to-do-if-your-vehicle-has-been-stolen", "Tell the police, your insurer and the DVLA."),
    ],
    "bicycle-theft": [
      L("Police.uk", "Protect your bike from theft", "https://www.police.uk/cp/crime-prevention/keeping-vehicles-safe/how-safe-is-your-bike/", "Locking technique, where to park, and getting a stolen bike back."),
      L("Secured by Design", "Bicycle security", "https://www.securedbydesign.com/guidance/crime-prevention-advice/bike-security", "Choosing tested locks and securing bikes at home."),
      L("Immobilise", "Register a bicycle", "https://www.immobilise.com/help/registerbike", "Free national register so police can trace a recovered bike to you."),
      L("Neighbourhood Watch", "Bicycle theft", "https://www.ourwatch.org.uk/protectyourbicycle", "Practical ways to cut the chance of losing your bike."),
    ],
    "criminal-damage-arson": [
      L("Police.uk", "Protect your property against vandalism", "https://www.police.uk/cp/crime-prevention/protect-home-crime/property-vandalism/", "Making your home a less tempting target."),
      L("Victim Support", "Criminal damage", "https://www.victimsupport.org.uk/crime-info/types-crime/criminal-damage/", "What counts as criminal damage, and support."),
      L("Victim Support", "Arson", "https://www.victimsupport.org.uk/crime-info/types-crime/arson/", "Help after a deliberate fire."),
      L("GOV.UK", "Report graffiti", "https://www.gov.uk/report-graffiti", "Find your council to get graffiti removed."),
    ],
    shoplifting: [
      L("Police.uk", "How to spot a shoplifter", "https://www.police.uk/cp/crime-prevention/keeping-business-safe-from-crime/spot-a-shoplifter/", "For students working in retail: the behaviour to watch for."),
      L("Victim Support", "Retail abuse and violence", "https://www.victimsupport.org.uk/crime-info/types-crime/retail-abuse-and-violence/", "Support for shop workers facing abuse at work."),
      L("Citizens Advice", "When a shop takes action to recover losses", "https://www.citizensadvice.org.uk/law-and-courts/legal-system/a-business-takes-legal-action-against-you-to-recover-losses-for-theft/", "What to do if a shop demands money after an alleged theft."),
    ],
    "other-theft": [
      L("Crimestoppers", "Crimes affecting students", "https://crimestoppers-uk.org/keeping-safe/community-family/crimes-affecting-students", "The crimes that most often target students, and anonymous reporting."),
      L("Police.uk", "Mark your property", "https://www.police.uk/cp/crime-prevention/protect-home-crime/mark-your-property/", "Mark and record valuables so they can be returned."),
      L("Immobilise", "Report items lost or stolen", "https://www.immobilise.com/help/reportingitemslostorstolen", "Flag registered items so they can be identified if found."),
      L("Neighbourhood Watch", "How crime affects students", "https://www.ourwatch.org.uk/Howcrimeaffectstudents", "What students worry about, with prevention tips."),
    ],
    "anti-social-behaviour": [
      L("Coventry City Council", "Anti-social behaviour", "https://www.coventry.gov.uk/community-safety-crime/anti-social-behaviour", "Which ASB goes to the council and which to the police."),
      L("Warwick District Council", "Anti-social behaviour", "https://www.warwickdc.gov.uk/info/20112/community_safety/124/anti-social_behaviour", "Council help for Leamington, Warwick and Kenilworth."),
      L("West Midlands Police", "Report antisocial behaviour", "https://www.westmidlands.police.uk/ro/report/asb/asb-v3/report-antisocial-behaviour/", "Report ASB in Coventry online."),
      L("GOV.UK", "ASB case review (the Community Trigger)", "https://www.gov.uk/guidance/anti-social-behaviour-asb-case-review-also-known-as-the-community-trigger", "Your right to a review if repeated reports went nowhere."),
    ],
    drugs: [
      L("FRANK", "Drugs A to Z", "https://www.talktofrank.com/drugs-a-z", "Honest facts on effects, risks and the law for each drug."),
      L("FRANK", "What to do in an emergency", "https://www.talktofrank.com/get-help/what-to-do-in-an-emergency", "What to do if someone reacts badly to a drug."),
      L("West Midlands Police", "County lines", "https://www.westmidlands.police.uk/advice/advice-and-information/cl/county-lines/", "How dealing gangs exploit young and vulnerable people."),
      L("GOV.UK", "Drugs penalties", "https://www.gov.uk/penalties-drug-possession-dealing", "Drug classes and the maximum penalties."),
    ],
    "other-crime": [
      L("Police.uk", "About police.uk crime data", "https://www.police.uk/pu/about-police.uk-crime-data/", "What “other crime” covers, and every other category."),
      L("Victim Support", "What is a crime?", "https://www.victimsupport.org.uk/crime-info/what-crime/", "Work out whether what happened counts as a crime."),
      L("GOV.UK", "Report a crime", "https://www.gov.uk/report-crime", "Where to report any kind of crime."),
    ],
  },
  general: {
    policeData: L("Police.uk", "About police.uk crime data", "https://www.police.uk/pu/about-police.uk-crime-data/", "What each category means and why locations are approximate."),
    anonymisation: L("data.police.uk", "How locations are anonymised", "https://data.police.uk/about/#location-anonymisation", "The technical detail behind the snap points."),
    streetsafe: L("Police.uk", "StreetSafe", "https://www.police.uk/pu/notices/streetsafe/street-safe/", "Tell police, anonymously, about a public place where you feel unsafe."),
    crimestoppers: L("Crimestoppers", "Give information anonymously", "https://crimestoppers-uk.org/give-information/forms/give-information-anonymously", "No name, no trace. Online or 0800 555 111."),
    victimSupport: L("Victim Support", "Victim Support", "https://www.victimsupport.org.uk/", "Free, confidential support after any crime, reported or not."),
    askForAngela: L("PSNI", "Ask for Angela", "https://www.psni.police.uk/safety-and-support/keeping-safe/ask-angela", "How asking bar staff for “Angela” gets you discreet help."),
  },
  reporting: [
    L("West Midlands Police", "Report a crime in Coventry", "https://www.westmidlands.police.uk/ro/report/ocr/af/how-to-report-a-crime/", "Non-emergency online reporting."),
    L("Warwickshire Police", "Report a crime in Leamington, Warwick or Kenilworth", "https://www.warwickshire.police.uk/ro/report/ocr/af/how-to-report-a-crime/", "Non-emergency online reporting."),
  ],
  students: [
    L("University of Warwick", "Report + Support", "https://reportandsupport.warwick.ac.uk/", "Report to the university with your name or anonymously, and find support."),
    L("University of Warwick", "Safety and Community Safety", "https://warwick.ac.uk/services/wss/topics/safety/", "On campus, Community Safety answers 24/7 on 024 7652 2222."),
    L("University of Warwick", "Safe Space in Leamington Spa", "https://reportandsupport.warwick.ac.uk/support/safe-space-in-leamington-spa", "Somewhere to go if you feel unsafe on a night out in Leam."),
    L("Coventry University", "Case Reporting System", "https://www.coventry.ac.uk/study-at-coventry/student-support/case-reporting-system/", "Report harassment, hate, sexual misconduct or spiking, anonymously if you like."),
    L("Coventry University", "Stay safe on campus", "https://www.coventry.ac.uk/student-central/coventry/stay-safe-on-campus/stay-safe-campus/", "Protection Services, help points and the SafeZone app."),
  ],
};
