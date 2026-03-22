#!/bin/bash
# Seed OSINT feeds from WorldMonitor's curated feed list.
# Usage: ./scripts/seed-osint-feeds.sh <problem-set-id>
#
# Adds ~80 high-quality RSS feeds relevant to military/intel C2 operations.
# Categories: defense, geopolitics, cyber, crisis, think tanks, regional news.

set -euo pipefail

API_BASE="${API_URL:-https://bastion.vitalpoint.ai}"
PS_ID="${1:?Usage: $0 <problem-set-id>}"

add_feed() {
  local name="$1" url="$2"
  echo "  Adding: $name"
  curl -s -X POST "$API_BASE/api/osint/feeds" \
    -H 'Content-Type: application/json' \
    -d "{
      \"problemSetId\": \"$PS_ID\",
      \"sourceName\": \"$name\",
      \"sourceType\": \"rss\",
      \"endpointUrl\": \"$url\",
      \"pollingIntervalMs\": 300000
    }" > /dev/null 2>&1 || echo "    (may already exist)"
}

echo "=== Seeding OSINT feeds for problem set: $PS_ID ==="

echo ""
echo "── Defense & Intelligence ──"
add_feed "Defense One" "https://www.defenseone.com/rss/all/"
add_feed "The War Zone" "https://www.twz.com/feed"
add_feed "Defense News" "https://www.defensenews.com/arc/outboundfeeds/rss/"
add_feed "Military Times" "https://www.militarytimes.com/arc/outboundfeeds/rss/"
add_feed "Task & Purpose" "https://taskandpurpose.com/feed/"
add_feed "USNI News" "https://news.usni.org/feed"
add_feed "gCaptain" "https://gcaptain.com/feed/"
add_feed "Oryx OSINT" "https://www.oryxspioenkop.com/feeds/posts/default?alt=rss"
add_feed "UK MOD" "https://www.gov.uk/government/organisations/ministry-of-defence.atom"
add_feed "War on the Rocks" "https://warontherocks.com/feed"

echo ""
echo "── Think Tanks & Policy ──"
add_feed "Foreign Policy" "https://foreignpolicy.com/feed/"
add_feed "Foreign Affairs" "https://www.foreignaffairs.com/rss.xml"
add_feed "RAND" "https://www.rand.org/pubs/articles.xml"
add_feed "FPRI" "https://www.fpri.org/feed/"
add_feed "Jamestown Foundation" "https://jamestown.org/feed/"
add_feed "Responsible Statecraft" "https://responsiblestatecraft.org/feed/"
add_feed "Stimson Center" "https://www.stimson.org/feed/"

echo ""
echo "── Crisis & International Orgs ──"
add_feed "Crisis Group" "https://www.crisisgroup.org/rss"
add_feed "IAEA" "https://www.iaea.org/feeds/topnews"
add_feed "WHO" "https://www.who.int/rss-feeds/news-english.xml"
add_feed "FAO News" "https://www.fao.org/feeds/fao-newsroom-rss"

echo ""
echo "── Cybersecurity ──"
add_feed "Krebs on Security" "https://krebsonsecurity.com/feed/"
add_feed "The Hacker News" "https://feeds.feedburner.com/TheHackersNews"
add_feed "Dark Reading" "https://www.darkreading.com/rss.xml"
add_feed "Schneier on Security" "https://www.schneier.com/feed/"
add_feed "Ransomware.live" "https://www.ransomware.live/rss.xml"

echo ""
echo "── World News (Wire Services) ──"
add_feed "BBC World" "https://feeds.bbci.co.uk/news/world/rss.xml"
add_feed "Guardian World" "https://www.theguardian.com/world/rss"
add_feed "Al Jazeera" "https://www.aljazeera.com/xml/rss/all.xml"
add_feed "France 24" "https://www.france24.com/en/rss"
add_feed "DW News" "https://rss.dw.com/xml/rss-en-all"

echo ""
echo "── Indo-Pacific ──"
add_feed "BBC Asia" "https://feeds.bbci.co.uk/news/world/asia/rss.xml"
add_feed "The Diplomat" "https://thediplomat.com/feed/"
add_feed "Japan Today" "https://japantoday.com/feed/atom"
add_feed "CNA Singapore" "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml"
add_feed "The Hindu" "https://www.thehindu.com/news/national/feeder/default.rss"
add_feed "NDTV" "https://feeds.feedburner.com/ndtvnews-top-stories"
add_feed "VnExpress" "https://vnexpress.net/rss/tin-moi-nhat.rss"
add_feed "ABC Australia" "https://www.abc.net.au/news/feed/2942460/rss.xml"
add_feed "Guardian Australia" "https://www.theguardian.com/australia-news/rss"
add_feed "Island Times Palau" "https://islandtimes.org/feed/"

echo ""
echo "── Middle East ──"
add_feed "BBC Middle East" "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"
add_feed "Guardian Middle East" "https://www.theguardian.com/world/middleeast/rss"
add_feed "Oman Observer" "https://www.omanobserver.om/rssFeed/1"

echo ""
echo "── Africa ──"
add_feed "BBC Africa" "https://feeds.bbci.co.uk/news/world/africa/rss.xml"
add_feed "News24 SA" "https://feeds.news24.com/articles/news24/TopStories/rss"
add_feed "Jeune Afrique" "https://www.jeuneafrique.com/feed/"
add_feed "Premium Times Nigeria" "https://www.premiumtimesng.com/feed"
add_feed "Vanguard Nigeria" "https://www.vanguardngr.com/feed/"
add_feed "Channels TV" "https://www.channelstv.com/feed/"
add_feed "Daily Trust" "https://dailytrust.com/feed/"

echo ""
echo "── Europe & Russia ──"
add_feed "Le Monde English" "https://www.lemonde.fr/en/rss/une.xml"
add_feed "Tagesschau" "https://www.tagesschau.de/xml/rss2/"
add_feed "ANSA Italy" "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml"
add_feed "BBC Russian" "https://feeds.bbci.co.uk/russian/rss.xml"
add_feed "Meduza" "https://meduza.io/rss/all"
add_feed "Moscow Times" "https://www.themoscowtimes.com/rss/news"
add_feed "RT" "https://www.rt.com/rss/"
add_feed "Novaya Gazeta Europe" "https://novayagazeta.eu/feed/rss"

echo ""
echo "── Latin America ──"
add_feed "BBC Latin America" "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml"
add_feed "Guardian Americas" "https://www.theguardian.com/world/americas/rss"
add_feed "InSight Crime" "https://insightcrime.org/feed/"
add_feed "Mexico News Daily" "https://mexiconewsdaily.com/feed/"
add_feed "Infobae" "https://www.infobae.com/arc/outboundfeeds/rss/"

echo ""
echo "── US Government ──"
add_feed "Federal Reserve" "https://www.federalreserve.gov/feeds/press_all.xml"
add_feed "SEC Press" "https://www.sec.gov/news/pressreleases.rss"
add_feed "NPR News" "https://feeds.npr.org/1001/rss.xml"
add_feed "PBS NewsHour" "https://www.pbs.org/newshour/feeds/rss/headlines"

echo ""
echo "── Energy & Commodities ──"
add_feed "OilPrice.com" "https://oilprice.com/rss/main"
add_feed "Rigzone" "https://www.rigzone.com/news/rss/rigzone_latest.aspx"
add_feed "EIA Reports" "https://www.eia.gov/rss/press_room.xml"
add_feed "Mining.com" "https://www.mining.com/feed/"
add_feed "Kitco News" "https://www.kitco.com/rss/KitcoNews.xml"

echo ""
echo "── Science & Environment ──"
add_feed "Nature News" "https://feeds.nature.com/nature/rss/current"
add_feed "ScienceDaily" "https://www.sciencedaily.com/rss/all.xml"
add_feed "Mongabay" "https://news.mongabay.com/feed/"

echo ""
echo ""
echo "=== Done. Feeds added. Run 'Poll Now' in the Understand tab or: ==="
echo "    curl -X POST $API_BASE/api/osint/feeds/poll-now"
