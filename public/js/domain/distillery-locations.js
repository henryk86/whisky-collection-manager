/**
 * Local reference locations for international whisky distilleries. The entries in
 * this supplementary directory are intentionally APPROXIMATE: where a surveyed
 * site position was unavailable, the locality of the distillery is used.
 * They must not be presented as surveyed GPS coordinates. Positions explicitly
 * saved by the collector always take priority. Historical or ambiguous names
 * without an identifiable location are deliberately absent.
 *
 * Name references: Scotch Whisky Association (2026), Uisge Beatha (2026),
 * Wikipedia list of Scottish whisky distilleries, MacLean & Bruce
 * historic-site descriptions and individual Whiskypedia records.
 * Some historic places are represented by their town or region centre only.
 * The database records and editable map must distinguish such approximate
 * positions from manually saved coordinates.
 */
const approximateSites = `
// International distilleries: locality-level estimates, not surveyed GPS positions.
Great Northern Distillery|54.0|-6.4
Pearse Lyons|53.34|-6.28
Dublin Liberties Distillery|53.34|-6.28
Ballykeefe|52.64|-7.24
Clonakilty|51.62|-8.88
Rademon Estate (Shortcross)|54.32|-5.71
Hinchtown (Hinch)|54.48|-5.92
Blackwater Distillery|52.09|-7.63
Ardara Distillery|54.76|-8.4
Kameda Distillery|37.91|139.11
Boann Distillery|53.74|-6.33
Ontake Distillery|31.74|130.81
Nikka Nishinomiya|34.74|135.34
Wilderness Trail Distillery|37.65|-84.77
Tsuzumi Distillery|35.45|135.07
Saburomaru|36.63|136.97
Osuzuyama|32.19|131.5
Kujira (Masahiro)|26.17|127.73
Willett|37.8|-85.47
Michter's|38.21|-85.53
Bardstown Bourbon Company|37.81|-85.47
New Riff|39.09|-84.5
Kings County Distillery|40.7|-73.97
Stranahan's|39.72|-104.99
Balcones|31.55|-97.13
Garrison Brothers|30.18|-98.56
Old Forester|38.26|-85.75
Frey Ranch Distillery|39.46|-119.44
North of 7 Distillery|45.42|-75.69
Okanagan Spirits|50.27|-119.27
Crown Royal (Gimli)|50.63|-96.99
Alberta Distillers|51.04|-114.07
Wayne Gretzky Estates|43.21|-79.13
Bearface (Mission Hill)|49.84|-119.56
Morris Whisky|-36.05|146.37
Archie Rose|-33.91|151.21
Ned Australian Whisky|-37.83|144.9
Fleurieu Distillery|-35.52|138.77
Overeem|-42.88|147.33
Waubs Harbour|-41.88|148.3
Kornog (Glann ar Mor)|48.8|-3.5
Le Breuil (Chateau du Breuil)|49.23|0.2
Castan|43.91|2.14
Moon Harbour|44.84|-0.58
Black Forest (Schladerer)|48.0|7.85
Dresdner Whisky Manufaktur|51.05|13.74
Spreewood Distillers|51.99|13.89
Blaue Maus|49.82|11.1
Brennerei Ehringhausen|51.76|7.87
Kymsee Whisky|47.88|12.43
Fercullen (Powerscourt)|53.18|-6.19
Killowen Distillery|54.1|-6.06
Copper Rivet|51.39|0.53
Adnams Copper House|52.33|1.68
Godawan (Diageo Alwar)|27.55|76.64
GianChand (DeVANS)|32.73|74.87
Ki One (Three Societies)|37.26|127.03
Goalong|28.23|112.94
Kozuba & Sons|54.35|18.65
Midleton|51.92|-8.17
Old Bushmills|55.2|-6.52
Cooley|54.04|-6.23
Kilbeggan|53.37|-7.5
Teeling|53.34|-6.27
Dingle|52.14|-10.27
West Cork Distillers|51.55|-9.26
Waterford Distillery|52.26|-7.11
Tullamore D.E.W.|53.27|-7.49
Slane|53.7|-6.54
Roe & Co|53.34|-6.29
Connacht|54.11|-9.16
Echlinville|54.47|-5.57
Yamazaki|34.89|135.67
Hakushu|35.83|138.32
Yoichi|43.19|140.78
Miyagikyo|38.31|140.66
Chichibu|35.99|139.07
Akkeshi|43.05|144.85
Fuji Gotemba|35.31|138.93
Shizuoka|35|138.39
Sakurao|34.35|132.33
Nagahama|35.38|136.27
Mars Komagatake|35.75|137.94
Mars Tsunuki|31.39|130.32
Kanosuke|31.59|130.33
Asaka|37.4|140.37
Hanyu|36.17|139.55
Karuizawa|36.34|138.64
Chita|34.99|136.86
Eigashima White Oak|34.64|134.97
Amrut|12.97|77.59
Paul John|15.49|73.82
Rampur|28.81|79.02
Piccadily (Indri)|29.99|76.98
Kavalan|24.75|121.76
Nantou (Omar)|23.91|120.68
Starward|-37.82|144.94
Sullivans Cove|-42.84|147.3
Lark|-42.88|147.33
Hellyers Road|-41.05|145.91
Bakery Hill|-37.84|145.17
Buffalo Trace|38.2|-84.87
Maker's Mark|37.65|-85.35
Wild Turkey|38.03|-84.89
Four Roses|38.04|-84.88
Heaven Hill (Bardstown)|37.81|-85.47
Woodford Reserve|38.11|-84.81
Jack Daniel's|35.28|-86.37
George Dickel|35.43|-86.24
Westland|47.57|-122.33
Westward Whiskey|45.52|-122.67
Hiram Walker|42.3|-83.03
Glenora|46.24|-61.3
Shelter Point|49.87|-125.13
Forty Creek|43.2|-79.57
St. Kilian|49.76|9.21
Slyrs|47.73|11.86
Elsburn|51.77|10.8
Hammerschmiede|51.77|10.8
Ziegler|49.79|9.24
Finch Whisky|48.44|9.49
Rothaus|47.8|8.25
Armorik (Warenghem)|48.72|-3.47
Rozelieures|48.45|6.44
Domaine des Hautes Glaces|44.82|5.76
Brenne (Cognac)|45.69|-0.33
High Coast|63.02|17.76
Spirit of Hven|55.91|12.7
Agitator|58.93|17.95
Mackmyra|60.67|17.14
Stauning|55.96|8.38
Thy Whisky|56.92|8.39
Myken|66.76|12.48
Teerenpeli|60.98|25.66
Kyrö|63.01|22.01
Bimber|51.53|-0.29
Cotswolds|52.04|-1.63
The Lakes|54.66|-3.21
Filey Bay (Spirit of Yorkshire)|54.21|-0.28
White Peak|53.06|-1.53
Penderyn|51.76|-3.52
Aber Falls|53.24|-4.02
In the Welsh Wind|52.13|-4.44
Milk & Honey (M&H)|32.05|34.77
Three Ships (James Sedgwick)|-33.64|18.99
Cardrona|-44.89|169
Thomson Whisky|-36.87|174.61
Langatun|47.22|7.79
Säntis Malt (Brauerei Locher)|47.33|9.41
Zuidam|51.85|4.93
Belgian Owl|50.66|5.24
Puni|46.69|10.54
Psenner|46.43|11.25
DYC|40.94|-4.11
Gold Cock|49.96|17.91
Eimverk (Flóki)|64.12|-21.83
Abasolo|19.83|-99.48
Union Distillery|-29.37|-51.19
8 Doors|58.64|-3.07
Abbeyhill|55.96|-3.17
Aberargie|56.40|-3.44
Aberfeldy|56.62|-3.87
Aberlour|57.47|-3.23
Adelphi|55.86|-4.25
Ailsa Bay|55.24|-4.86
Albyn|55.43|-5.61
Allt a’ Bhainne|57.40|-3.21
Annandale|55.01|-3.28
Arbikie|56.63|-2.55
Ardgowan|55.91|-4.87
Ardlussa|55.425|-5.607
Ardmore|57.35|-2.91
Ardnamurchan|56.72|-6.09
Ardross|57.74|-4.32
Argyll|55.43|-5.61
Argyll (first / McKinnon's)|55.425|-5.607
Auchentoshan|55.93|-4.44
Auchinblae|56.89|-2.47
Auchnagie|56.66|-3.74
Auchroisk|57.55|-3.12
Auchtermuchty|56.295|-3.235
Auchtertool|56.1|-3.27
Aultmore|57.58|-2.99
Badachro|57.73|-5.72
Balblair|57.84|-4.18
Ballechin|56.7|-3.72
Ballindalloch|57.41|-3.38
Balmaud|57.62|-2.49
Balmenach|57.32|-3.40
Balvenie|57.45|-3.13
Banff|57.64|-2.66
Bankier|56.02|-3.91
Bellfield|55.94|-4.15
Ben Nevis|56.84|-5.08
Benachie|57.34|-2.61
Benbecula|57.47|-7.36
Benmore|55.43|-5.61
BenRiach|57.60|-3.30
Benrinnes|57.44|-3.23
Benromach|57.59|-3.60
Blackness Bay|56.00|-3.52
Bladnoch|54.86|-4.46
Blair Athol|56.70|-3.73
Bon Accord|57.15|-2.094
Bonnington|55.96|-3.17
Borders|55.42|-2.79
Bothy|56.76|-3.12
Bo’ness|56.01|-3.61
Braeval|57.35|-3.28
Broombrae|55.425|-5.607
Brora|58.02|-3.86
Burn o’Bennie|57.07|-2.49
Burnside|55.425|-5.607
Cabrach|57.33|-2.92
Cairn|57.31|-3.43
Caledonian|55.95|-3.23
Caledonian (Campbeltown)|55.425|-5.607
Cambus|56.12|-3.83
Cameronbridge|56.19|-3.08
Camlachie|55.859|-4.224
Campbeltown|55.425|-5.607
Canonmills|55.966|-3.2
Caol Ila|55.8545|-6.1093
Caperdonich|57.52|-3.20
Cardhu|57.47|-3.35
Carsebridge|56.11|-3.80
Clydesdale|55.77|-3.92
Clydeside|55.86|-4.29
Clynelish|58.02|-3.85
Coleburn|57.60|-3.29
Convalmore|57.45|-3.13
Cragganmore|57.41|-3.39
Craigellachie|57.50|-3.19
Daftmill|56.30|-3.09
Dailuaine|57.45|-3.28
Dalaruan|55.425|-5.607
Dalintober|55.425|-5.607
Dallas Dhu|57.60|-3.61
Dalmore|57.70|-4.26
Dalmunach|57.47|-3.24
Dalwhinnie|56.94|-4.24
Dean|55.951|-3.22
Deanston|56.19|-4.07
Deerness|58.90|-2.72
Delnabo|57.235839|-3.393335
Devanha|57.15|-2.094
Dornoch|57.88|-4.03
Drumcaldie|56.25|-3.2
Drumore|55.425|-5.607
Dufftown|57.45|-3.13
Dumbarton|55.945|-4.57
Dundashill|55.87|-4.25
Dunphail|57.49|-3.61
Eden Mill|56.36|-2.82
Edradour|56.70|-3.70
Falkirk|56.00|-3.79
Fettercairn|56.84|-2.58
Galloway|54.94|-4.50
Garnheath|55.86|-3.98
Gartloch|55.91|-4.1
Gerston|58.51|-3.49
Gerston II|58.51|-3.49
Girvan|55.24|-4.86
Glasgow|55.84|-4.21
Glen Albyn|57.49|-4.25
Glen Cawdor|57.584|-3.87
Glen Coull|56.67|-2.93
Glen Elgin|57.61|-3.28
Glen Flagler|55.85|-3.97
Glen Flagler / Killyloch|55.85|-3.97
Glen Garioch|57.34|-2.41
Glen Grant|57.53|-3.20
Glen Keith|57.55|-2.95
Glen Mhor|57.49|-4.25
Glen Moray|57.64|-3.34
Glen Nevis|55.425|-5.607
Glen Ord|57.53|-4.48
Glen Sciennes|55.942|-3.17
Glen Scotia|55.42|-5.61
Glen Tarras|55.152|-2.996
Glenaden|57.53|-2.13
GlenAllachie|57.47|-3.25
Glenburgie|57.62|-3.55
Glencadam|56.73|-2.66
Glencraig|57.62|-3.55
Glendarroch|56.018|-5.447
Glendronach|57.49|-2.72
Glendullan|57.46|-3.12
Glenesk|56.74|-2.66
Glenfarclas|57.40|-3.33
Glenfiddich|57.45|-3.13
Glenfoyle|56.125|-4.085
Glenglassaugh|57.68|-2.74
Glengoyne|56.03|-4.36
Glengyle|55.43|-5.60
Gleniffer|55.825|-4.483
Glenkinchie|55.89|-2.90
Glenlivet|57.35|-3.34
Glenlochy|56.83|-5.11
Glenlossie|57.62|-3.33
Glenmavis|55.901|-3.64
Glenmorangie|57.84|-4.07
Glenochil|56.151|-3.85
Glenpatrick|55.825|-4.483
Glenramskill|55.425|-5.607
Glenrothes|57.53|-3.23
Glenside|55.4307|-5.6095
Glenskiach|57.665|-4.35
Glentauchers|57.54|-3.05
Glenturret|56.39|-3.87
Glenugie|57.48|-1.77
Glenury Royal|56.96|-2.21
Grandtully|56.656|-3.778
Grange|56.059|-3.236
Greenock|55.948|-4.762
Hazelburn (historic distillery)|55.425|-5.607
Highland (Campbeltown)|55.425|-5.607
Highland Park|58.97|-2.95
Holyrood|55.94|-3.19
Huntly|57.45|-2.79
Imperial|57.47|-3.24
InchDairnie|56.21|-3.16
Inchgower|57.66|-2.99
Invergordon|57.69|-4.19
Inverleven|55.94|-4.57
Isla|56.394|-3.43
Isle of Harris|57.90|-6.80
Isle of Jura|55.84|-5.96
Isle of Raasay|57.35|-6.08
Isle of Tiree|56.50|-6.87
Jackton|55.75|-4.22
John O'Groats (original, 1826)|58.64|-3.07
Kilchoman|55.7869|-6.4308
Killyloch|55.85|-3.97
Kinclaith|55.85|-4.24
Kingsbarns|56.29|-2.66
Kininvie|57.45|-3.13
Kinloch|55.425|-5.607
Kintyre|55.425|-5.607
Kirkapool|56.5|-6.87
Kirkliston|55.953|-3.405
Kirktown|57.505038|-1.786404
Knockando|57.46|-3.35
Knockdhu|57.40|-2.75
Kythe|56.55|-3.26
Ladyburn|55.24|-4.86
Lagg|55.44|-5.22
Langholm|55.152|-2.996
Lindores Abbey|56.34|-3.21
Linkwood|57.62|-3.30
Littlemill|55.94|-4.49
Loch Ewe|57.834667|-5.57391
Loch Lomond Grain|55.99|-4.59
Loch Lomond Malt|55.99|-4.59
Lochead|55.425|-5.607
Lochgilphead|56.036|-5.43
Lochindaal|55.77|-6.36
Lochlea|55.58|-4.42
Lochranza|55.71|-5.29
Lochrin|55.944|-3.214
Lochruan|55.425|-5.607
Lochside|56.71|-2.47
Lochside (Campbeltown)|55.425|-5.607
Lone Wolf|57.37|-2.07
Longmorn|57.61|-3.29
Longrow (historic distillery)|55.425|-5.607
Macallan|57.48|-3.20
Macduff|57.67|-2.49
Man O'Hoy|58.86|-3.34
Mannochmore|57.61|-3.33
Meadowburn|55.425|-5.607
Mill of Banff|57.666|-2.525
Millburn|57.48|-4.22
Miltonduff|57.64|-3.36
Moffat|55.33|-3.44
Mortlach|57.45|-3.13
Mossfield|55.425|-5.607
Mosstowie|57.64|-3.36
Mountain Dew (Thistle)|55.425|-5.607
Ncn'ean|56.66|-5.96
Nevis|56.82|-5.11
North British|55.93|-3.25
North of Scotland|56.12|-3.83
North Point|58.61|-3.63
North Port|56.73|-2.66
North Uist|57.60|-7.36
Oban|56.41|-5.47
Old Clynelish / Brora|58.02|-3.86
Orkney|58.98|-2.96
Parkmore|57.47|-3.23
Pittyvaich|57.45|-3.13
Pollo|57.719304|-4.110246
Port Dundas|55.87|-4.26
Port of Leith|55.98|-3.17
Provanmill|55.886|-4.2
Pulteney|58.43|-3.10
Reivers|55.60|-2.76
Rieclachan|55.425|-5.607
Rosebank|56.00|-3.79
Roseisle|57.64|-3.52
Royal Brackla|57.54|-3.93
Royal Lochnagar|57.04|-3.23
Saucel|55.84|-4.42
Scapa|58.96|-2.97
Speyburn|57.55|-3.24
Springbank|55.43|-5.61
Springside|55.425|-5.607
St Magdalene|55.98|-3.61
Starlaw|55.89|-3.60
Stirling|56.12|-3.94
Strathclyde|55.85|-4.25
Strathdee|57.15|-2.094
Strathearn|56.41|-3.77
Strathisla|57.54|-2.96
Strathmeldrum|57.34|-2.41
Strathmore|56.12|-3.83
Stronachie|56.345|-3.48
Sunbury|55.95|-3.22
Talisker|57.30|-6.35
Tambowie|55.94|-4.32
Tamdhu|57.46|-3.34
Tamnavulin|57.32|-3.29
Teaninich|57.69|-4.26
Tober an Righ|55.425|-5.607
Tobermory|56.62|-6.07
Tomatin|57.34|-4.00
Tomdachoille|56.68|-3.7
Tomintoul|57.31|-3.30
Torabhaig|57.10|-5.85
Tormore|57.37|-3.31
Toulvaddie|57.80|-3.96
Towiemore|57.45|-3.01
Tullibardine|56.30|-3.73
Uile-bheist|57.48|-4.22
Union (Campbeltown)|55.425|-5.607
West Highland (Campbeltown)|55.425|-5.607
West Lochlin|56.32|-3.84
Wolfburn|58.59|-3.52
Wormyhill|56.56|-2.65
Yardheads|55.975|-3.17
Yoker|55.892|-4.38
`;

export const normalizeDistilleryName = name => String(name || '')
    .normalize('NFKD').toLocaleLowerCase('en')
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ')
    .trim().replace(/^the /, '').replace(/ distillery$/, '');

export const APPROXIMATE_LOCATIONS = new Map(approximateSites.trim().split('\n').map(row => {
    const [name, lat, lon] = row.split('|');
    return [normalizeDistilleryName(name), Object.freeze([Number(lat), Number(lon)])];
}));
