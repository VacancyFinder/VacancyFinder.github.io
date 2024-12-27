# Crawl coverage

| | Companies |
|---|---|
| Crawled (ready + active) | 40 |
| Careers page known, not crawled yet (needs-adapter) | 15 |
| Deliberately not crawled (active: false) | 23 |
| Website known, careers page unknown (needs-discovery) | 98 |
| No website known (needs-research) | 120 |
| **Total** | **296** |

## Crawled

| Company | Method | Notes |
|---|---|---|
| 99x | html | 99x open-positions page, Sri Lanka filter (verified Sep 2026). |
| Abans Finance PLC | html | Vacancies grouped by department; details open in a popup on the same page (verified Sep 2026). |
| Ascentic | teamtailor | Teamtailor careers site (career.ascentic.se), read from its public RSS feed. 'Talent pool' entries are CV drop-boxes, not vacancies, and are skipped (verified Sep 2026). |
| Asian Hotels & Properties PLC | html | keells.com/careers links to the group's SAP SuccessFactors site; its search results (51 roles, 10 per page) are read page by page (verified Sep 2026). The RSS feed is disallowed by robots.txt. |
| Brown and Company PLC | custom: simplifiedhr | brownsgroup.com/careers links to its SimplifiedHR career page; vacancies come from that page's JSON (8 at probe time, verified Sep 2026). |
| Browns Beach Hotels PLC | custom: simplifiedhr | brownsgroup.com/careers links to its SimplifiedHR career page; vacancies come from that page's JSON (8 at probe time, verified Sep 2026). |
| Browns Investments PLC | custom: simplifiedhr | brownsgroup.com/careers links to its SimplifiedHR career page; vacancies come from that page's JSON (8 at probe time, verified Sep 2026). |
| C T Holdings PLC | html | Cargills careers page lists openings as sections (4 at probe time); its PeoplesHR portal was empty (verified Sep 2026). |
| Cargills (Ceylon) PLC | html | Cargills careers page lists openings as sections (4 at probe time); its PeoplesHR portal was empty (verified Sep 2026). |
| Ceylon Cold Stores PLC | html | keells.com/careers links to the group's SAP SuccessFactors site; its search results (51 roles, 10 per page) are read page by page (verified Sep 2026). The RSS feed is disallowed by robots.txt. |
| Citizens Development Business Finance PLC | html | CDB careers page lists open positions (verified Sep 2026). |
| Creative Software | html | Webflow list of open vacancies on the careers page (verified Sep 2026). |
| Dialog Axiata PLC | html | dialog.lk/careers links to Dialog's MiHCM career portal; listings are in its HTML (31 roles at probe time, verified Sep 2026). Office buildings are shown instead of towns, so the location is Colombo. |
| Dialog Finance PLC | html | dialog.lk/careers links to Dialog's MiHCM career portal; listings are in its HTML (31 roles at probe time, verified Sep 2026). Office buildings are shown instead of towns, so the location is Colombo. |
| Diesel & Motor Engineering PLC | html | DIMO vacancies page (paginated). Listings past their closing date are dropped — at probe time all 4 had closed (verified Sep 2026). |
| Digital Mobility Solutions Lanka PLC (PickMe) | html | PickMe's own careers page lists current openings (verified Sep 2026). |
| Flat Rock Technology | custom: flatrock | Careers page is filled from Flat Rock's own job feed; 8 of 26 global roles were in Colombo at probe time (verified Sep 2026). |
| Fortude | custom: fortude | careers.fortude.co lists roles from its own job-list endpoint (17 at probe time); Apply goes to Fortude's TalentRecruit ATS (verified Sep 2026). |
| Haycarb PLC | custom: oracle-hcm | hayleys.com/careers links to Oracle Recruiting Cloud (site CX_23001, 93 roles, 90 in Sri Lanka at probe time); read via its public requisitions API (verified Sep 2026). |
| Hayleys PLC | custom: oracle-hcm | hayleys.com/careers links to Oracle Recruiting Cloud (site CX_23001, 93 roles, 90 in Sri Lanka at probe time); read via its public requisitions API (verified Sep 2026). |
| Hayleys Fabric PLC | custom: oracle-hcm | hayleys.com/careers links to Oracle Recruiting Cloud (site CX_23001, 93 roles, 90 in Sri Lanka at probe time); read via its public requisitions API (verified Sep 2026). |
| Hayleys Fibre PLC | custom: oracle-hcm | hayleys.com/careers links to Oracle Recruiting Cloud (site CX_23001, 93 roles, 90 in Sri Lanka at probe time); read via its public requisitions API (verified Sep 2026). |
| Hayleys Leisure PLC | custom: oracle-hcm | hayleys.com/careers links to Oracle Recruiting Cloud (site CX_23001, 93 roles, 90 in Sri Lanka at probe time); read via its public requisitions API (verified Sep 2026). |
| John Keells PLC | html | keells.com/careers links to the group's SAP SuccessFactors site; its search results (51 roles, 10 per page) are read page by page (verified Sep 2026). The RSS feed is disallowed by robots.txt. |
| John Keells Holdings PLC | html | keells.com/careers links to the group's SAP SuccessFactors site; its search results (51 roles, 10 per page) are read page by page (verified Sep 2026). The RSS feed is disallowed by robots.txt. |
| Keells Food Products PLC | html | keells.com/careers links to the group's SAP SuccessFactors site; its search results (51 roles, 10 per page) are read page by page (verified Sep 2026). The RSS feed is disallowed by robots.txt. |
| Lanka IOC PLC | html | 'Current openings' page linked from lankaioc.com/careers (verified Sep 2026). |
| LSEG | custom: workday | Workday career site, filtered to the Sri Lanka country facet (28 roles at probe time, verified Sep 2026). Millennium IT roles are listed here. |
| National Development Bank PLC | html | ndbbank.com/careers links to NDB's MiHCM career portal (14 roles at probe time, verified Sep 2026). Dates are month/day/year. |
| Pearson | custom: oracle-hcm | Pearson's Oracle Recruiting Cloud site, filtered to Sri Lanka (3 roles at probe time, verified Sep 2026). |
| Rootcode | custom: rootcode | Careers page is filled from rootcode.ai/api/jobs; roles in Estonia are filtered out (verified Sep 2026). |
| Sri Lanka Telecom PLC | html | Openings are listed as headings on slt.lk/careers; applications go through careers.slt.lk (verified Sep 2026). |
| Surge Global | custom: rooster | Surge's own careers page embeds its roles through Rooster's integration API (company 3; 5 roles at probe time, verified Sep 2026). |
| Sysco LABS | custom: workday | syscolabs.lk/careers links to Sysco's Workday site filtered to 'Sysco LABS - Sri Lanka' (87 roles at probe time, verified Sep 2026). |
| Union Bank of Colombo PLC | custom: peopleshr | unionb.com/careers redirects to its PeoplesHR job portal; vacancies come from the portal's JSON (2 at probe time, verified Sep 2026). The portal has no per-vacancy link, so Apply opens the portal. |
| Vallibel One PLC | html | 'Our openings' section on the careers page (verified Sep 2026). |
| WSO2 | html | Careers page lists global roles as cards; only Sri Lanka roles are kept (verified Sep 2026). |
| ZILLIONe | custom: zillione | Careers page is filled from apisv1.zillione.com/api/careers (verified Sep 2026). |
| Zone24x7 | html | Careers page lists current vacancies as cards (verified Sep 2026). |
| Zyner.io | html | Zyner's own careers page lists roles; Apply links go to its Rooster postings (verified Sep 2026). |

## Not crawled — and why

| Company | Reason |
|---|---|
| Access Engineering PLC | Careers URL from the CSE list returns HTTP 404 (verified Sep 2026); needs the current careers page. |
| Central Finance Company PLC | Not crawled: robots.txt disallows the careers page (verified Sep 2026). |
| Ceylinco Insurance PLC | ceylinco.com from the CSE list is a parked domain for sale (verified Sep 2026); the insurer's real site needs research. |
| Ceylon Tobacco Company PLC | ceylontobacco.com from the CSE list is a parked domain (verified Sep 2026); the real careers page needs research. |
| CodeGen | Not crawled: robots.txt disallows codegen.co.uk/careers (verified Sep 2026). |
| DFCC Bank PLC | Careers URL from the CSE list returns HTTP 404 (verified Sep 2026); needs the current careers page. |
| HCLTech | Not crawled: robots.txt disallows hcltech.com/careers (verified Sep 2026). Global portal. |
| Hela Apparel Holdings PLC | Not crawled: robots.txt disallows the careers page (verified Sep 2026). |
| IFS | IFS hires in Sri Lanka through SmartRecruiters (ifs1), but SmartRecruiters' robots.txt disallows its public API (verified Sep 2026). |
| John Keells Hotels PLC | careers.cinnamonhotels.com's vacancy API returns ~12 MB per request (embedded images), too heavy to poll every 3 hours. Cinnamon roles on the John Keells careers site are still credited here (verified Sep 2026). |
| LB Finance PLC | Careers URL from the CSE list returns HTTP 404 (verified Sep 2026); needs the current careers page. |
| LOLC Finance PLC | Careers URL from the CSE list returns HTTP 404 (verified Sep 2026); needs the current careers page. |
| LOLC General Insurance PLC | Careers URL from the CSE list returns HTTP 404 (verified Sep 2026); needs the current careers page. |
| LOLC Holdings PLC | Careers URL from the CSE list returns HTTP 404 (verified Sep 2026); needs the current careers page. |
| Melstacorp PLC | Careers URL from the CSE list returns HTTP 404 (verified Sep 2026); needs the current careers page. |
| Nations Trust Bank PLC | Careers page returns HTTP 403 to automated requests (verified Sep 2026). |
| Pan Asia Banking Corporation PLC | Not crawled: robots.txt disallows the careers page (verified Sep 2026). |
| People's Leasing & Finance PLC | Not crawled: robots.txt disallows the careers page (verified Sep 2026). |
| Sampath Bank PLC | Vacancies are published only as images with an MS Forms link (no text to read) (verified Sep 2026). |
| Singer (Sri Lanka) PLC | singer.lk/careers redirects to the singersl.com homepage; no careers page found (verified Sep 2026). |
| Swisstek (Ceylon) PLC | Not crawled: robots.txt disallows the careers page (verified Sep 2026). |
| Swivel Group | Careers on SmartRecruiters (SwivelGroup), but SmartRecruiters' robots.txt disallows its public API (verified Sep 2026). |
| Teejay Lanka PLC | Careers URL from the CSE list returns HTTP 404 (verified Sep 2026); needs the current careers page. |
| Abans Electricals PLC | The 'Work with us' page has no vacancy listings (verified Sep 2026); nothing to crawl yet. |
| ACL Cables PLC | The careers page has no vacancy listings (verified Sep 2026); nothing to crawl yet. |
| Aitken Spence PLC | Careers page points to topjobs.lk and a Google Form; third-party boards are not crawled in v1 (verified Sep 2026). |
| Aitken Spence Hotel Holdings PLC | Careers page points to topjobs.lk and a Google Form; third-party boards are not crawled in v1 (verified Sep 2026). |
| Aitken Spence Plantation Managements PLC | Careers page points to topjobs.lk and a Google Form; third-party boards are not crawled in v1 (verified Sep 2026). |
| Dilmah Ceylon Tea Company PLC | The careers page has no vacancy listings (verified Sep 2026); nothing to crawl yet. |
| Hatton National Bank PLC | hnb.lk/careers has a general application form but no vacancy listings (verified Sep 2026). |
| Hemas Holdings PLC | The careers page has no vacancy listings (verified Sep 2026); nothing to crawl yet. |
| Jetwing Symphony PLC | Careers page groups vacancies by department; every department showed 'no vacancies' at probe time, so the markup of a real listing is unknown (verified Sep 2026). |
| Seylan Bank PLC | 'Available vacancies' is a table that was empty at probe time, so extraction can't be verified yet (verified Sep 2026). |
| Softlogic Capital PLC | Careers page points to topjobs.lk; third-party boards are not crawled in v1 (verified Sep 2026). |
| Softlogic Finance PLC | Careers page points to topjobs.lk; third-party boards are not crawled in v1 (verified Sep 2026). |
| Softlogic Holdings PLC | Careers page points to topjobs.lk; third-party boards are not crawled in v1 (verified Sep 2026). |
| Softlogic Life Insurance PLC | Careers page points to topjobs.lk; third-party boards are not crawled in v1 (verified Sep 2026). |
| Sunshine Holdings PLC | Careers page points to LinkedIn jobs; third-party boards are not crawled in v1 (verified Sep 2026). |

## Discovery candidates awaiting review

Found by `pnpm discover` (homepage links, sitemaps, common paths). **Nothing here is crawled** until a maintainer
copies an approved URL into `careersUrl` and picks an adapter (see README → Add a company).

| Companies | Best candidate | Score | Evidence |
|---|---|---|---|
| 99x | https://99x.io/careers | 10 | homepage link "Careers"; common path /careers → 200; common path /careers/ → 200 |
| acl-plastics | https://www.acl.lk/careers | 10 | homepage link "CAREERS"; common path /careers → 200; common path /careers/ → 200 |
| alliance-finance-company | https://www.alliancefinance.lk/about-us/careers/ | 9 | homepage link "Careers"; sitemap entry in /sitemap.xml |
| alumex | https://alumexgroup.com/careers/ | 24 | homepage link "Careers"; sitemap entry in /page-sitemap.xml; common path /careers → 200 (/careers/) |
| amana-bank | https://www.amanabank.lk/careers/ | 14 | homepage link "Careers"; homepage link "Working at Amana Bank"; sitemap entry in /sitemap.xml |
| ambeon-capital, ambeon-holdings | https://www.ambeon.com/careers | 4 | common path /careers → 200; common path /careers/ → 200 |
| asiri-hospital-holdings, asiri-surgical-hospital | https://asirihealth.com/careers#priorities | 49 | homepage link "People's Priorities"; homepage link "Vacancies"; homepage link "Career Progression" |
| atlas-labs | https://atlaslabs.com.au/#careers | 3 | homepage link "Careers" |
| bairaha-farms | https://www.bairaha.com/corporate/careers.html | 12 | homepage link "Careers"; sitemap entry in /sitemap.xml; common path /careers → 200 (/corporate/careers.html) |
| cargills-bank | https://www.cargillsbank.com/careers/ | 13 | homepage link "Careers"; common path /careers → 200 (/careers/); common path /career → 200 (/careers/) |
| bukit-darah, carson-cumberbatch, ceylon-guardian-investment-trust, ceylon-investment | https://www.carsoncumberbatch.com/careers/ | 18 | homepage link "Careers"; homepage link "Join now"; homepage link "" |
| colombo-dockyard | https://www.cdl.lk/careers | 4 | common path /careers → 200; common path /careers/ → 200 |
| cic-holdings | https://www.cic.lk/careers-page/ | 6 | homepage link "Careers"; sitemap entry in /sitemap.xml |
| citrus-leisure | https://citrusleisure.com/careers/ | 16 | homepage link "Careers"; common path /careers → 200 (/careers/); common path /career → 200 (/careers/) |
| creative-software | https://www.creativesoftware.com/careers | 20 | homepage link "Careers"; sitemap entry in /sitemap.xml; common path /careers → 200 |
| dipped-products | https://www.dplgroup.com/careers/ | 9 | sitemap entry in /wp-sitemap-posts-page-1.xml; common path /careers → 200 (/careers/); common path /careers/ → 200 |
| ceylon-hospitals | https://www.durdans.com/careers/ | 18 | homepage link "Careers"; sitemap entry in /sitemap.xml; common path /careers → 200 (/careers/) |
| e-b-creasy-and-company | https://www.ebcreasy.com/careers | 4 | common path /careers → 200; common path /careers/ → 200 |
| e-channelling | https://www.echannelling.com/careers | 7 | common path /careers → 200; common path /careers/ → 200 (/careers) |
| expolanka-holdings | https://www.expolanka.com/careers-and-people/ | 20 | homepage link "Careers & People"; sitemap entry in /sitemap.xml; sitemap entry in /image-sitemap.xml |
| flat-rock-technology | https://flatrocktech.com/careers | 15 | homepage link "Careers"; homepage link "Open Positions0"; common path /careers → 200 |
| fortude | https://careers.fortude.co/ | 6 | homepage link "Explore Jobs" |
| hdfc-bank-of-sri-lanka | https://www.hdfc.lk/careers | 15 | homepage link "Careers"; sitemap entry in /sitemap.xml; common path /careers → 200 |
| hype-invention | https://hypeinvention.com/careers | 6 | common path /careers → 200; common path /careers/ → 200 |
| janashakthi-insurance | https://www.janashakthi.com/careers | 17 | homepage link "Careers"; homepage link "Life at Janashakthi"; homepage link "Join Us" |
| jat-holdings | https://www.jatholdings.com/careers/ | 12 | homepage link "Careers"; sitemap entry in /sitemap.xml; common path /careers → 200 (/careers/) |
| kapruka-holdings | https://blog.kapruka.com/kapruka_careers | 7 | homepage link "Kapruka Careers"; homepage link "Careers" |
| octave | https://www.keells.com/careers/ | 3 | sitemap entry in /sitemap.xml |
| lake-house-printers-and-publishers | https://lakehouse.lk/observer-jobs/ | 9 | homepage link "Observer Jobs"; sitemap entry in /wp-sitemap-posts-page-1.xml |
| the-lanka-hospitals-corporation | https://www.lankahospitals.com/careers/ | 22 | homepage link "Careers"; common path /careers → 200 (/careers/); common path /career → 200 (/careers/) |
| laugfs-gas, laugfs-power | https://www.laugfs.lk/careers/ | 80 | homepage link "Careers"; homepage link "Why Work at LAUGFS"; homepage link "Vacancies" |
| ceylon-beverage-holdings, lion-brewery-ceylon | https://www.lionbeer.com/careers | 4 | common path /careers → 200; common path /careers/ → 200 |
| lseg | https://www.lseg.com/en/careers | 15 | homepage link "Explore our job opportunities"; homepage link "Careers"; sitemap entry in /en/sitemap-index.xml |
| pearson | https://www.pearson.com/work.html | 3 | homepage link "Workforce & Career Development" |
| people-s-insurance | https://peoplesinsurance.lk/careers/ | 24 | homepage link "Careers"; sitemap entry in /page-sitemap.xml; common path /careers → 200 (/careers/) |
| prime-lands-residencies | https://www.primelands.lk/careers/en | 12 | homepage link "Careers"; sitemap entry in /sitemap.xml |
| printcare | https://printcare.lk/careers/ | 15 | homepage link "Careers"; sitemap entry in /wp-sitemap-posts-page-1.xml; common path /careers → 200 |
| renuka-agri-foods, renuka-city-hotels, renuka-foods, renuka-holdings, renuka-hotels | https://www.renukagroup.com/careers/index.php | 7 | homepage link "Careers" |
| resus-energy | https://www.resusenergy.lk/careers.html | 9 | homepage link "Careers"; sitemap entry in /sitemap.xml |
| rootcode | https://rootcode.ai/careers | 2 | sitemap entry in /sitemap.xml |
| sanasa-development-bank | https://www.sdb.lk/en/about-us/careers | 9 | sitemap entry in /sitemap.xml; common path /careers → 200 (/en/about-us/careers); common path /careers/ → 200 (/en/about-us/careers) |
| sierra-cables | https://www.sierracables.com/career/ | 9 | homepage link "Careers"; sitemap entry in /sitemap.xml; common path /career → 200 (/career/) |
| singhe-hospitals | https://www.singhehospital.com/careers | 2 | sitemap entry in /pages-sitemap.xml |
| snapdrum | https://snapdrum.com/careers | 4 | common path /careers → 200; common path /careers/ → 200 |
| surge-global | https://surge.global/careers/ | 18 | homepage link "Careers"; sitemap entry in /page-sitemap.xml; common path /careers → 200 (/careers/) |
| sysco-labs | https://syscolabs.lk/careers | 4 | common path /careers → 200; common path /careers/ → 200 |
| tokyo-cement-company-lanka | https://tokyocement.com/careers | 14 | homepage link "Careers"; sitemap entry in /wp-sitemap-posts-page-1.xml; common path /careers → 200 (/careers/) |
| vallibel-finance | https://vallibelfinance.com/careers/ | 24 | homepage link "Careers"; sitemap entry in /page-sitemap.xml; common path /careers → 200 |
| vidullanka | https://vidullanka.com/careers/ | 17 | homepage link "Careers"; homepage link "Learn More"; sitemap entry in /wp-sitemap-posts-page-1.xml |
| windforce | https://windforce.lk/careers/ | 21 | homepage link "Careers"; sitemap entry in /page-sitemap.xml; common path /careers → 200 (/careers/) |
| wso2 | https://wso2.com/careers/ | 18 | homepage link "Careers"; sitemap entry in /sitemap.xml; common path /careers → 200 |
| zegates | https://zegates.com/careers/ | 14 | homepage link "Careers"; homepage link "CareersOpen roles & internships"; sitemap entry in /sitemap.xml |
| zone24x7 | https://zone24x7.com/careers/ | 23 | homepage link "Careers"; homepage link "1 More open vacancies"; homepage link "None Available" |
| zyner-io | https://careers.zyner.io/ | 10 | homepage link "Careers" |

40 domains gave no candidate (unreachable, blocked by robots.txt, or no careers link).

