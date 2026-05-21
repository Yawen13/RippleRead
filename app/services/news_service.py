import re
import traceback
from typing import Optional

import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

from ..core.text_utils import calculate_lexile

BBC_RSS_URLS = {
    'general': 'https://feeds.bbci.co.uk/news/rss.xml',
    'technology': 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'business': 'https://feeds.bbci.co.uk/news/business/rss.xml',
    'science': 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'sports': 'https://feeds.bbci.co.uk/sport/rss.xml',
}

NYT_RSS_URLS = {
    'general': 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    'technology': 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
    'business': 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
    'science': 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
    'sports': 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',
}

FALLBACK_NEWS = {
    'general': [
        {
            "title": "Global Leaders Discuss Climate Action at Summit",
            "content": "World leaders from over one hundred nations gathered at the annual Climate Action Summit in Geneva this week to discuss new measures for combating climate change. The summit focused on reducing carbon emissions across all major industries, with particular attention to the energy and transportation sectors.\n\nSeveral countries announced ambitious new targets for renewable energy adoption, pledging to phase out coal-fired power plants within the next decade. The European Union unveiled a comprehensive plan to invest hundreds of billions of euros in green technology research and development over the coming years.\n\nEnvironmental groups praised the commitments but warned that more urgent action is needed to limit global temperature rise to 1.5 degrees Celsius above pre-industrial levels. Scientists at the conference presented new data showing that the window for effective climate action is narrowing rapidly.\n\nDeveloping nations called for greater financial support from wealthier countries to help them transition to clean energy without sacrificing economic growth. Negotiations on a global carbon trading mechanism are expected to continue throughout the remainder of the summit.",
            "url": "https://example.com/news/climate-summit",
            "source": "BBC News",
            "category": "general",
            "lexile": 880,
            "published_at": "2026-05-13T10:00:00Z"
        },
        {
            "title": "New Study Reveals Benefits of Daily Reading",
            "content": "Researchers at the University of Cambridge have published a comprehensive study showing that reading for just fifteen minutes a day can significantly improve vocabulary, comprehension, and cognitive function in both adults and children. The study, which followed over five thousand participants across three years, found that regular readers demonstrated measurably better memory retention and critical thinking skills compared to non-readers.\n\nThe research team discovered that the benefits of reading extend far beyond language acquisition. Participants who maintained a daily reading habit showed lower stress levels, improved empathy, and better sleep quality. The findings have prompted educators around the world to call for renewed emphasis on reading programs in schools and communities.\n\nInterestingly, the study found that the format of reading material did not significantly affect the cognitive benefits. Whether participants read physical books, e-books, or even long-form articles on their devices, the positive effects were consistent as long as the reading material required sustained attention. The researchers emphasized that the key factor was the habit of focused, uninterrupted reading rather than the specific content or medium.",
            "url": "https://example.com/news/reading-study",
            "source": "BBC News",
            "category": "general",
            "lexile": 750,
            "published_at": "2026-05-13T09:30:00Z"
        },
        {
            "title": "World Economy Shows Signs of Recovery After Global Challenges",
            "content": "Economic indicators from major markets around the world suggest that a steady recovery is underway following years of global economic challenges. Manufacturing output has risen for the fourth consecutive quarter, while service sector activity has reached its highest level since before recent disruptions.\n\nConsumer confidence surveys show that households in developed economies are increasingly optimistic about their financial prospects. Retail sales figures have surpassed expectations in the United States, Europe and parts of Asia, indicating that consumer spending remains a powerful engine of economic growth.\n\nHowever, economists caution that the recovery remains uneven across different regions and industries. While technology and healthcare sectors have surged ahead, traditional manufacturing and hospitality industries continue to face significant headwinds. The International Monetary Fund has urged governments to maintain supportive fiscal policies while gradually reducing emergency stimulus measures.",
            "url": "https://example.com/news/economy-recovery",
            "source": "Financial Times",
            "category": "general",
            "lexile": 950,
            "published_at": "2026-05-13T08:00:00Z"
        }
    ],
    'technology': [
        {
            "title": "AI Breakthrough Promises Faster Drug Discovery",
            "content": "A team of researchers from leading pharmaceutical laboratories and artificial intelligence companies has developed a new AI model that can predict molecular interactions ten times faster than previous systems. This breakthrough promises to dramatically accelerate the drug discovery process, potentially reducing the time and cost required to bring new medicines to market.\n\nThe model, which uses advanced machine learning algorithms trained on vast databases of molecular structures and biological interactions, can screen billions of potential drug compounds in a matter of hours. Traditional methods would take months or even years to accomplish the same task. The research team published their findings in the journal Nature Biotechnology, where they described the novel approach and its implications for the pharmaceutical industry.\n\nEarly applications of the technology have already shown remarkable results. In one case study, the AI system identified a promising compound for treating a rare form of cancer that had previously eluded researchers using conventional methods. The compound is now entering clinical trials, and researchers are optimistic about its therapeutic potential.\n\nIndustry experts believe that AI-driven drug discovery could help address some of the most pressing medical challenges of our time, including antibiotic resistance, neurodegenerative diseases, and emerging viral threats. Pharmaceutical companies around the world are investing heavily in similar technologies, hoping to gain a competitive edge in the race to develop the next generation of life-saving medications.",
            "url": "https://example.com/news/ai-drug-discovery",
            "source": "BBC News",
            "category": "technology",
            "lexile": 920,
            "published_at": "2026-05-13T11:00:00Z"
        },
        {
            "title": "Quantum Computing Milestone Achieved by Research Team",
            "content": "Scientists at a major research laboratory have successfully demonstrated a quantum computer with one thousand stable qubits, marking a significant milestone on the path toward practical quantum computing applications. The achievement, announced at a press conference on Friday, represents a major leap forward in the field of quantum information science.\n\nThe new quantum processor, which operates at temperatures close to absolute zero, maintained quantum coherence for several hundred microseconds during test operations. This duration, while brief by everyday standards, is long enough to perform complex calculations that would be impossible for classical computers to complete in any reasonable timeframe.\n\nResearchers demonstrated the system's capabilities by solving a complex optimization problem related to protein folding, a task with direct applications in drug development and molecular biology. The quantum computer completed the calculation in seconds, whereas a conventional supercomputer would have required several days to achieve the same result.\n\nDespite this impressive achievement, experts caution that fully fault-tolerant quantum computers capable of running arbitrary algorithms are still years away. Current systems remain prone to errors and require sophisticated error correction techniques. Nevertheless, the progress made represents a crucial step toward realizing the transformative potential of quantum computing across fields ranging from cryptography to materials science.",
            "url": "https://example.com/news/quantum-milestone",
            "source": "Wired",
            "category": "technology",
            "lexile": 980,
            "published_at": "2026-05-13T10:30:00Z"
        },
        {
            "title": "Cybersecurity Threats Rise as Remote Work Continues",
            "content": "Companies around the world are facing an unprecedented wave of cybersecurity challenges as the shift toward remote and hybrid work arrangements continues to expand the attack surface for malicious actors. A new report from a leading cybersecurity firm reveals that attempted cyber attacks on corporate networks have increased by more than sixty percent over the past year.\n\nThe report highlights several key trends driving this surge in cyber threats. Remote workers often use personal devices and unsecured home networks to access corporate systems, creating vulnerabilities that hackers can exploit. Additionally, the rapid adoption of cloud-based services has introduced new vectors for attack that many organizations have not adequately secured.\n\nSecurity experts are recommending a multi-layered approach to defending against these threats. This includes implementing strong multi-factor authentication for all remote access points, providing comprehensive security awareness training to employees at all levels, and deploying advanced threat detection systems that use artificial intelligence to identify suspicious activity in real time.\n\nGovernments around the world are also taking action to address the growing cybersecurity challenge. New regulations requiring companies to report data breaches promptly and maintain minimum security standards are being introduced in several jurisdictions, placing additional pressure on organizations to invest in robust cybersecurity infrastructure.",
            "url": "https://example.com/news/cybersecurity-remote-work",
            "source": "BBC News",
            "category": "technology",
            "lexile": 860,
            "published_at": "2026-05-13T08:30:00Z"
        }
    ],
    'business': [
        {
            "title": "Global Markets Rally on Positive Trade Negotiations",
            "content": "Stock markets around the world surged sharply on Wednesday after major economies announced significant progress in ongoing trade negotiations. The breakthrough, which came after months of intensive diplomatic discussions, boosted investor confidence and led to widespread gains across all major indices.\n\nThe negotiations focused on reducing tariffs and removing regulatory barriers that have hampered international commerce in recent years. Negotiators from the United States, the European Union, China and several other major trading partners agreed to a framework that would lower trade costs and simplify customs procedures for thousands of products.\n\nMarket analysts described the announcement as a turning point for global economic relations. The technology sector was among the biggest beneficiaries of the rally, with shares of major companies surging on expectations that reduced trade barriers would expand their access to international markets. Manufacturing and agricultural stocks also posted strong gains.\n\nWhile the agreement represents a significant step forward, final details still need to be ironed out in the coming weeks. Some industry groups have expressed concerns about specific provisions, particularly those related to intellectual property protection and data privacy regulations. Nevertheless, the overall market reaction suggests growing optimism about the trajectory of the global economy and the potential for renewed international cooperation.",
            "url": "https://example.com/news/markets-rally",
            "source": "Financial Times",
            "category": "business",
            "lexile": 960,
            "published_at": "2026-05-13T10:30:00Z"
        },
        {
            "title": "Central Banks Adjust Interest Rates to Control Inflation",
            "content": "Major central banks across the world are implementing carefully calibrated adjustments to interest rates as they seek to balance the competing demands of controlling inflation and supporting economic growth. The decisions reflect the complex economic environment facing policymakers in the aftermath of recent global disruptions.\n\nThe Federal Reserve announced a modest increase in its benchmark interest rate, citing persistent inflationary pressures in certain sectors of the economy. The European Central Bank and the Bank of England followed with similar moves, though they emphasized that future decisions would be data-dependent and could change if economic conditions shift significantly.\n\nThese monetary policy adjustments have significant implications for consumers and businesses alike. Higher interest rates typically increase the cost of borrowing for mortgages, car loans and business investments, which can slow economic activity. However, they also help to preserve the purchasing power of savings and prevent the erosion of living standards through inflation.\n\nEconomists are divided on whether the current pace of rate adjustments is appropriate. Some argue that central banks should move more aggressively to get ahead of inflation expectations, while others warn that tightening too quickly could derail the economic recovery and potentially trigger a recession.",
            "url": "https://example.com/news/central-banks-rates",
            "source": "BBC News",
            "category": "business",
            "lexile": 1040,
            "published_at": "2026-05-13T09:00:00Z"
        },
        {
            "title": "Sustainable Business Practices Drive Long-Term Growth",
            "content": "A growing body of research indicates that companies adopting environmentally sustainable business practices are seeing improved financial performance and stronger brand loyalty among increasingly conscious consumers. The findings challenge the traditional view that environmental responsibility comes at the expense of profitability.\n\nA comprehensive study conducted by a leading business school analyzed the financial performance of over two thousand companies across multiple industries over a ten-year period. The results showed that firms with strong environmental, social and governance programs consistently outperformed their peers in terms of revenue growth, profit margins and stock market valuation.\n\nConsumer surveys conducted alongside the financial analysis revealed a clear preference for brands that demonstrate genuine commitment to sustainability. Younger consumers in particular are willing to pay premium prices for products that are produced in environmentally responsible ways, and they are more likely to recommend such brands to their social networks.\n\nThe trend toward sustainable business practices is being reinforced by regulatory changes in many countries. Governments are introducing stricter environmental standards and requiring companies to disclose their carbon emissions and sustainability initiatives. Major investors are also increasingly factoring sustainability metrics into their investment decisions, creating powerful incentives for companies to prioritize environmental performance alongside traditional financial metrics.",
            "url": "https://example.com/news/sustainable-business",
            "source": "BBC News",
            "category": "business",
            "lexile": 910,
            "published_at": "2026-05-13T07:30:00Z"
        }
    ],
    'science': [
        {
            "title": "New Species Discovered in Deep Ocean Expedition",
            "content": "Marine biologists have identified more than thirty previously unknown species during a deep sea exploration mission in the Pacific Ocean. The expedition, which used state-of-the-art remotely operated vehicles capable of descending to depths of over four thousand meters, explored previously inaccessible regions of the ocean floor.\n\nAmong the most remarkable discoveries were several species of bioluminescent fish that produce their own light through chemical reactions within their bodies. The researchers also documented new types of deep sea corals, crustaceans, and mollusks that have evolved unique adaptations to survive in the extreme conditions of the deep ocean environment.\n\nThe discoveries highlight how much remains unknown about life in the deepest parts of our oceans. Scientists estimate that more than eighty percent of the ocean remains unexplored and that millions of species may await discovery. Each new species provides valuable information about evolutionary processes and the resilience of life under extreme conditions of pressure, temperature and darkness.\n\nConservation groups have called for increased protection of deep sea ecosystems, which face growing threats from deep sea mining, bottom trawling and climate change. The expedition's findings are being used to support arguments for the creation of new marine protected areas in international waters.",
            "url": "https://example.com/news/deep-sea-species",
            "source": "BBC News",
            "category": "science",
            "lexile": 870,
            "published_at": "2026-05-13T11:15:00Z"
        },
        {
            "title": "Gene Therapy Shows Promise for Treating Rare Diseases",
            "content": "Clinical trials for a new gene therapy approach have shown remarkable results in treating previously incurable genetic disorders in patients of all ages. The treatment, which uses modified viruses to deliver healthy copies of defective genes to patients' cells, has demonstrated both safety and efficacy in early stage trials.\n\nResearchers at a leading medical research institute reported that the therapy successfully corrected the underlying genetic defect in more than eighty percent of treated patients. The improvements were sustained over a follow-up period of two years, suggesting that the benefits of the treatment may be long-lasting or even permanent.\n\nThe gene therapy approach represents a fundamental shift in how doctors think about treating genetic diseases. Rather than managing symptoms with lifelong medication regimens, the therapy aims to fix the root cause of the condition at the molecular level. This could potentially eliminate the need for ongoing treatment and dramatically improve the quality of life for millions of patients worldwide.\n\nWhile the results are extremely encouraging, the treatment remains expensive and complex to administer. Researchers are working on ways to streamline the manufacturing process and reduce costs so that the therapy can be made available to all patients who need it, regardless of their economic circumstances.",
            "url": "https://example.com/news/gene-therapy",
            "source": "BBC News",
            "category": "science",
            "lexile": 1010,
            "published_at": "2026-05-13T10:00:00Z"
        },
        {
            "title": "Astronomers Discover New Planet in Habitable Zone",
            "content": "An international team of astronomers has announced the discovery of a new exoplanet orbiting a nearby star within the so-called habitable zone where conditions might be suitable for liquid water to exist on the planet's surface. The discovery, made using data from both ground-based observatories and space telescopes, has generated considerable excitement in the scientific community.\n\nThe newly discovered planet is approximately one point three times the size of Earth and orbits its parent star at a distance that places it squarely in the region where temperatures could allow for the presence of liquid water. The star is a red dwarf located about forty light years from Earth, making it one of the closest potentially habitable planets ever discovered.\n\nAstronomers plan to conduct follow-up observations using more powerful instruments, including the James Webb Space Telescope, to analyze the planet's atmosphere for signs of water vapor, methane, oxygen or other chemical signatures that could indicate the presence of life. Such observations are extremely challenging due to the faintness of the planet relative to its host star, but advances in telescope technology are making them increasingly feasible.\n\nWhile the discovery does not constitute evidence of extraterrestrial life, it adds to a growing catalog of planets that could potentially support life. Each new discovery helps scientists refine their understanding of how common Earth-like planets might be in our galaxy and informs the search for life beyond our solar system.",
            "url": "https://example.com/news/exoplanet-discovery",
            "source": "BBC News",
            "category": "science",
            "lexile": 890,
            "published_at": "2026-05-13T08:30:00Z"
        }
    ],
    'sports': [
        {
            "title": "Underdog Team Wins National Championship Title",
            "content": "In one of the most stunning upsets in recent sporting history, an underdog team has defeated the heavily favored defending champions to claim the national championship title. The match, played before a record-breaking crowd of over eighty thousand spectators at the national stadium, will be remembered as one of the greatest championship games ever played.\n\nThe underdog team entered the competition as an unlikely contender, having only narrowly qualified for the tournament earlier in the season. Few analysts gave them any chance against the defending champions, who had dominated the league throughout the year and boasted a roster filled with internationally recognized star players.\n\nHowever, the underdogs delivered a performance of extraordinary determination and tactical discipline. Their defense held firm against repeated attacks from their opponents, while their offense capitalized on rare opportunities with clinical efficiency. The decisive moment came in the final minutes of the match when a perfectly executed play resulted in the winning score, sending their supporters into wild celebration.\n\nThe victory has captured the imagination of sports fans around the world and serves as a powerful reminder of why sport continues to fascinate and inspire. The team's journey from obscurity to glory demonstrates that with enough dedication, belief and teamwork, even the most improbable dreams can be achieved.",
            "url": "https://example.com/news/sports-championship",
            "source": "BBC Sport",
            "category": "sports",
            "lexile": 730,
            "published_at": "2026-05-13T11:30:00Z"
        },
        {
            "title": "Olympic Committee Announces New Sports for Next Games",
            "content": "The International Olympic Committee has approved the inclusion of several new sports for the upcoming Olympic Games, as part of its ongoing efforts to modernize the Olympic program and attract younger audiences. The decision was announced following a meeting of the committee's executive board in Lausanne, Switzerland.\n\nThe newly approved sports include disciplines that have experienced explosive growth in popularity in recent years, particularly among younger demographics. Organizers hope that the inclusion of these sports will help the Olympics remain relevant and exciting for new generations of sports fans around the world.\n\nThe selection process considered multiple factors including global participation rates, youth appeal, gender equality and the cost and complexity of hosting events. Each candidate sport was required to demonstrate that it had an established international federation, a robust anti-doping program and a significant following across multiple continents.\n\nNational Olympic committees around the world have welcomed the announcement and are already beginning to develop training programs for athletes in the new disciplines. The addition of these sports is expected to create new opportunities for athletes who might not have previously had a clear path to Olympic competition.",
            "url": "https://example.com/news/olympic-new-sports",
            "source": "BBC Sport",
            "category": "sports",
            "lexile": 800,
            "published_at": "2026-05-13T10:45:00Z"
        },
        {
            "title": "Youth Soccer Program Expands to Underserved Communities",
            "content": "A major international sports organization has announced a significant expansion of its youth development program to provide coaching, equipment and facilities to children in underserved communities around the world. The initiative, which represents one of the largest investments in grassroots sports development in recent decades, aims to reach millions of young people across more than fifty countries.\n\nThe program will establish new training centers in areas where access to organized sports is limited or nonexistent. Each center will be staffed by qualified coaches who will not only teach soccer skills but also emphasize the importance of education, health and character development. The organization has partnered with local schools and community groups to ensure that the program is integrated into the fabric of each community it serves.\n\nBeyond the obvious physical benefits of regular exercise, participation in organized sports has been shown to improve academic performance, develop social skills and build self-confidence in young people. The program's organizers hope that by providing these opportunities, they can help break the cycle of poverty and create pathways to success for children who might otherwise have limited options in life.\n\nEarly pilot programs in several countries have already yielded impressive results, with participants showing measurable improvements in school attendance, academic achievement and overall wellbeing. The expansion announced today will build on these successes and extend the program's reach to communities that need it most.",
            "url": "https://example.com/news/youth-soccer",
            "source": "BBC Sport",
            "category": "sports",
            "lexile": 690,
            "published_at": "2026-05-13T09:15:00Z"
        }
    ]
}

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

_ua_index = 0


def _get_headers():
    global _ua_index
    ua = USER_AGENTS[_ua_index % len(USER_AGENTS)]
    _ua_index += 1
    return {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }


def _fetch_full_text(url):
    if not url:
        return ""
    try:
        resp = requests.get(url, headers=_get_headers(), timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "lxml")
        paragraphs = []

        article_tag = soup.find("article")
        if article_tag:
            for p in article_tag.find_all("p"):
                text = p.get_text(strip=True)
                if len(text) > 40:
                    paragraphs.append(text)

        if len(paragraphs) < 3:
            for selector_class in ["article-body", "story-body", "post-content", "entry-content", "article-content", "main-content"]:
                div = soup.find("div", class_=lambda c, s=selector_class: c and s in " ".join(c).lower())
                if div:
                    for p in div.find_all("p"):
                        text = p.get_text(strip=True)
                        if len(text) > 40 and text not in paragraphs:
                            paragraphs.append(text)
                    break

        if len(paragraphs) < 3:
            for p in soup.find_all("p"):
                text = p.get_text(strip=True)
                if len(text) < 50:
                    continue
                low = text.lower()
                if any(x in low for x in [
                    "cookie", "subscribe", "advertisement", "all rights reserved",
                    "\u00a9", "click here", "sign up", "newsletter", "related articles",
                    "share this", "follow us", "terms of use", "privacy policy",
                    "you may also like", "sponsored content", "recommended for you"
                ]):
                    continue
                paragraphs.append(text)

        if not paragraphs:
            return ""

        full_text = "\n\n".join(paragraphs)
        full_text = re.sub(r'\n{3,}', '\n\n', full_text)
        full_text = re.sub(r' {2,}', ' ', full_text)
        if len(full_text) > 5000:
            full_text = full_text[:5000].rsplit('.', 1)[0] + '.'
        return full_text.strip()
    except Exception as e:
        print(f"Full-text fetch error for {url}: {e}")
        return ""


def _parse_rss_item(item, category):
    title = ''
    description = ''
    link = ''
    pub_date = ''
    source = 'BBC News'
    for child in item:
        tag = child.tag.split('}')[-1]
        text = (child.text or '').strip()
        if tag == 'title':
            title = text
        elif tag == 'description':
            description = re.sub(r'<[^>]+>', '', text)
        elif tag == 'link':
            link = text
        elif tag == 'pubDate':
            pub_date = text
        elif tag == 'source':
            source = text or 'BBC News'
    return {
        "title": title,
        "description": description[:300],
        "url": link,
        "source": source,
        "category": category,
        "published_at": pub_date,
    }


def _fetch_news_from_rss(category, fetch_full_text=True, max_articles=5):
    articles = []
    errors = []

    bbc_url = BBC_RSS_URLS.get(category)
    if bbc_url:
        try:
            resp = requests.get(bbc_url, timeout=5, headers=_get_headers())
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            items = root.findall('.//item')
            for item in items[:10]:
                articles.append(_parse_rss_item(item, category))
        except Exception as e:
            errors.append(f"BBC RSS failed: {e}")

    if len(articles) < 5:
        nyt_url = NYT_RSS_URLS.get(category)
        if nyt_url:
            try:
                resp = requests.get(nyt_url, timeout=5, headers=_get_headers())
                resp.raise_for_status()
                root = ET.fromstring(resp.content)
                items = root.findall('.//item')
                for item in items[:10]:
                    article = _parse_rss_item(item, category)
                    if not any(a['url'] == article['url'] for a in articles):
                        articles.append(article)
            except Exception as e:
                errors.append(f"NYT RSS failed: {e}")

    if fetch_full_text and articles:
        target = articles[:max_articles]
        for i, article in enumerate(target):
            if not article.get('url'):
                article['content'] = article.get('description', '')
                article['lexile'] = calculate_lexile(article['content'])
                continue
            try:
                print(f"Fetching full text [{i+1}/{len(target)}]: {article['title'][:60]}...")
                full_text = _fetch_full_text(article['url'])
                if full_text and len(full_text) > 100:
                    article['content'] = full_text
                    article['lexile'] = calculate_lexile(full_text)
                else:
                    desc = article.get('description', '') or article.get('title', '')
                    article['content'] = desc
                    article['lexile'] = calculate_lexile(desc)
                    if full_text:
                        errors.append(f"Thin content for: {article['title'][:50]}")
            except Exception as e:
                errors.append(f"Per-article fail '{article['title'][:50]}': {e}")
                desc = article.get('description', '') or article.get('title', '')
                article['content'] = desc
                article['lexile'] = calculate_lexile(desc)

    return articles, errors


def _get_fallback_news(category):
    return FALLBACK_NEWS.get(category, FALLBACK_NEWS['general'])


def fetch_news(category='general'):
    articles = []
    errors = []
    source_used = 'fallback'
    try:
        fetched, fetch_errors = _fetch_news_from_rss(category, False)
        articles = fetched
        errors.extend(fetch_errors)
        if articles:
            source_used = 'bbc_nyt_rss'
    except Exception as e:
        errors.append(f"RSS fetch exception: {e}")
    if not articles:
        print(f"News RSS failed, using fallback. Errors: {errors}")
        articles = _get_fallback_news(category)
    return articles, source_used, errors


def fetch_news_to_library(category='general'):
    articles = []
    errors = []
    try:
        fetched, fetch_errors = _fetch_news_from_rss(category)
        articles = fetched
        errors.extend(fetch_errors)
    except Exception as e:
        errors.append(f"RSS fetch exception: {e}")
    if not articles:
        print(f"fetch-news RSS failed, using fallback. Errors: {errors}")
        articles = _get_fallback_news(category)
    return articles, errors
