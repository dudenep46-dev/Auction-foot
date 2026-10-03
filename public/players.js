/* Player pool. Format: Name|Position|Club|Nation|Rating
   Ratings and clubs are approximate. Edit freely: add lines, change ratings,
   and the opening price is derived from the rating (see basePrice). */
(function (root) {
  const RAW = [
    // Forwards
    'Kylian Mbappé|FWD|Real Madrid|FRA|91', 'Erling Haaland|FWD|Manchester City|NOR|91',
    'Lamine Yamal|FWD|Barcelona|ESP|90', 'Ousmane Dembélé|FWD|Paris Saint-Germain|FRA|90',
    'Mohamed Salah|FWD|Liverpool|EGY|90', 'Vinícius Júnior|FWD|Real Madrid|BRA|90',
    'Harry Kane|FWD|Bayern Munich|ENG|90', 'Raphinha|FWD|Barcelona|BRA|88',
    'Lionel Messi|FWD|Inter Miami|ARG|88', 'Lautaro Martínez|FWD|Inter Milan|ARG|88',
    'Bukayo Saka|FWD|Arsenal|ENG|88', 'Robert Lewandowski|FWD|Barcelona|POL|87',
    'Khvicha Kvaratskhelia|FWD|Paris Saint-Germain|GEO|87', 'Alexander Isak|FWD|Liverpool|SWE|87',
    'Michael Olise|FWD|Bayern Munich|FRA|87', 'Cole Palmer|FWD|Chelsea|ENG|87',
    'Cristiano Ronaldo|FWD|Al Nassr|POR|86', 'Rafael Leão|FWD|AC Milan|POR|86',
    'Victor Osimhen|FWD|Galatasaray|NGA|86', 'Julián Álvarez|FWD|Atlético Madrid|ARG|86',
    'Luis Díaz|FWD|Bayern Munich|COL|86', 'Viktor Gyökeres|FWD|Arsenal|SWE|85',
    'Son Heung-min|FWD|LAFC|KOR|85', 'Rodrygo|FWD|Real Madrid|BRA|85',
    'Antoine Griezmann|FWD|Atlético Madrid|FRA|85', 'Nico Williams|FWD|Athletic Club|ESP|85',
    'Leroy Sané|FWD|Galatasaray|GER|84', 'Mikel Oyarzabal|FWD|Real Sociedad|ESP|84',
    'Omar Marmoush|FWD|Manchester City|EGY|84', 'Marcus Rashford|FWD|Barcelona|ENG|83',
    'Karim Benzema|FWD|Al Ittihad|FRA|83', 'Kingsley Coman|FWD|Al Nassr|FRA|83',
    'Serge Gnabry|FWD|Bayern Munich|GER|83', 'Bryan Mbeumo|FWD|Manchester United|CMR|83',
    'Ollie Watkins|FWD|Aston Villa|ENG|83', 'Ademola Lookman|FWD|Atalanta|NGA|83',
    'Neymar|FWD|Santos|BRA|82', 'Gabriel Martinelli|FWD|Arsenal|BRA|82',
    'Dušan Vlahović|FWD|Juventus|SRB|82', 'Jérémy Doku|FWD|Manchester City|BEL|82',
    'Anthony Gordon|FWD|Newcastle United|ENG|82', 'Jonathan David|FWD|Juventus|CAN|82',
    'Christian Pulisic|FWD|AC Milan|USA|82', 'Mohammed Kudus|FWD|Tottenham Hotspur|GHA|82',
    'Matheus Cunha|FWD|Manchester United|BRA|82', 'Darwin Núñez|FWD|Al Hilal|URU|81',
    'Pedro Neto|FWD|Chelsea|POR|81', 'Jarrod Bowen|FWD|West Ham United|ENG|81',
    'Alexander Sørloth|FWD|Atlético Madrid|NOR|80', 'Gonçalo Ramos|FWD|Paris Saint-Germain|POR|80',
    'Jack Grealish|FWD|Everton|ENG|80', 'Sadio Mané|FWD|Al Nassr|SEN|80',
    'Riyad Mahrez|FWD|Al Ahli|ALG|80', 'Benjamin Šeško|FWD|Manchester United|SVN|80',
    'Takefusa Kubo|FWD|Real Sociedad|JPN|80', 'Dominic Solanke|FWD|Tottenham Hotspur|ENG|80',
    'Alejandro Garnacho|FWD|Chelsea|ARG|80', 'Federico Chiesa|FWD|Liverpool|ITA|79',
    'Randal Kolo Muani|FWD|Tottenham Hotspur|FRA|79', 'Artem Dovbyk|FWD|Roma|UKR|79',
    'Ángel Di María|FWD|Rosario Central|ARG|78', 'Memphis Depay|FWD|Corinthians|NED|77',
    'Tammy Abraham|FWD|Beşiktaş|ENG|77', 'Rasmus Højlund|FWD|Napoli|DEN|77',
    'Folarin Balogun|FWD|Monaco|USA|77', 'Ivan Toney|FWD|Al Ahli|ENG|77',
    'Jamie Vardy|FWD|Cremonese|ENG|76', 'Joshua Zirkzee|FWD|Manchester United|NED|76',
    'Álvaro Morata|FWD|Como|ESP|76', 'Raúl Jiménez|FWD|Fulham|MEX|75', 'Mathys Tel|FWD|Tottenham Hotspur|FRA|75',
    // Midfielders
    'Rodri|MID|Manchester City|ESP|90', 'Jude Bellingham|MID|Real Madrid|ENG|90',
    'Pedri|MID|Barcelona|ESP|88', 'Jamal Musiala|MID|Bayern Munich|GER|88',
    'Vitinha|MID|Paris Saint-Germain|POR|87', 'Florian Wirtz|MID|Liverpool|GER|87',
    'Martin Ødegaard|MID|Arsenal|NOR|87', 'Declan Rice|MID|Arsenal|ENG|87',
    'Federico Valverde|MID|Real Madrid|URU|87', 'Kevin De Bruyne|MID|Napoli|BEL|87',
    'Joshua Kimmich|MID|Bayern Munich|GER|87', 'Bernardo Silva|MID|Manchester City|POR|86',
    'Phil Foden|MID|Manchester City|ENG|86', 'Bruno Fernandes|MID|Manchester United|POR|86',
    'Nicolò Barella|MID|Inter Milan|ITA|86', 'Frenkie de Jong|MID|Barcelona|NED|85',
    'Hakan Çalhanoğlu|MID|Inter Milan|TUR|85', 'Alexis Mac Allister|MID|Liverpool|ARG|85',
    'João Neves|MID|Paris Saint-Germain|POR|85', 'Aurélien Tchouaméni|MID|Real Madrid|FRA|85',
    'Bruno Guimarães|MID|Newcastle United|BRA|85', 'Ryan Gravenberch|MID|Liverpool|NED|85',
    'Luka Modrić|MID|AC Milan|CRO|84', 'Dominik Szoboszlai|MID|Liverpool|HUN|84',
    'Moisés Caicedo|MID|Chelsea|ECU|84', 'Fabián Ruiz|MID|Paris Saint-Germain|ESP|84',
    'Martín Zubimendi|MID|Arsenal|ESP|84', 'Gavi|MID|Barcelona|ESP|83',
    'Enzo Fernández|MID|Chelsea|ARG|83', 'Eduardo Camavinga|MID|Real Madrid|FRA|83',
    'Sandro Tonali|MID|Newcastle United|ITA|83', 'Scott McTominay|MID|Napoli|SCO|83',
    'Kai Havertz|MID|Arsenal|GER|83', 'Dani Olmo|MID|Barcelona|ESP|83',
    'Eberechi Eze|MID|Arsenal|ENG|83', 'Tijjani Reijnders|MID|Manchester City|NED|83',
    'Arda Güler|MID|Real Madrid|TUR|82', 'Marcos Llorente|MID|Atlético Madrid|ESP|82',
    'Mikel Merino|MID|Arsenal|ESP|82', 'James Maddison|MID|Tottenham Hotspur|ENG|82',
    'Teun Koopmeiners|MID|Juventus|NED|82', 'Adrien Rabiot|MID|AC Milan|FRA|82',
    'Xavi Simons|MID|Tottenham Hotspur|NED|82', 'Julian Brandt|MID|Borussia Dortmund|GER|82',
    'Morgan Rogers|MID|Aston Villa|ENG|82', 'Rayan Cherki|MID|Manchester City|FRA|82',
    'Lucas Paquetá|MID|West Ham United|BRA|81', 'Leon Goretzka|MID|Bayern Munich|GER|81',
    'Youri Tielemans|MID|Aston Villa|BEL|81', 'Fermín López|MID|Barcelona|ESP|81',
    'Sergej Milinković-Savić|MID|Al Hilal|SRB|81', 'Casemiro|MID|Manchester United|BRA|80',
    'Rodrigo De Paul|MID|Inter Miami|ARG|80', 'Koke|MID|Atlético Madrid|ESP|80',
    'Granit Xhaka|MID|Sunderland|SUI|80', 'Manuel Locatelli|MID|Juventus|ITA|80',
    'İlkay Gündoğan|MID|Galatasaray|GER|80', "N'Golo Kanté|MID|Al Ittihad|FRA|80",
    'Rúben Neves|MID|Al Hilal|POR|80', 'Mateo Kovačić|MID|Manchester City|CRO|80',
    'Warren Zaïre-Emery|MID|Paris Saint-Germain|FRA|80', 'Pablo Barrios|MID|Atlético Madrid|ESP|79',
    'Thomas Partey|MID|Villarreal|GHA|79', 'John McGinn|MID|Aston Villa|SCO|79',
    'Conor Gallagher|MID|Atlético Madrid|ENG|79', 'Marco Verratti|MID|Al Arabi|ITA|78',
    'Marcelo Brozović|MID|Al Nassr|CRO|78', 'Kobbie Mainoo|MID|Manchester United|ENG|78',
    'Giovani Lo Celso|MID|Real Betis|ARG|78', 'Mason Mount|MID|Manchester United|ENG|77',
    'Christian Eriksen|MID|Wolfsburg|DEN|77', 'Manuel Ugarte|MID|Manchester United|URU|77',
    'Isco|MID|Real Betis|ESP|77', 'Jorginho|MID|Flamengo|ITA|77', 'Jobe Bellingham|MID|Borussia Dortmund|ENG|76',
    'Marc Casadó|MID|Barcelona|ESP|76',
    // Defenders
    'Virgil van Dijk|DEF|Liverpool|NED|89', 'William Saliba|DEF|Arsenal|FRA|88',
    'Rúben Dias|DEF|Manchester City|POR|88', 'Achraf Hakimi|DEF|Paris Saint-Germain|MAR|87',
    'Alessandro Bastoni|DEF|Inter Milan|ITA|87', 'Gabriel Magalhães|DEF|Arsenal|BRA|87',
    'Marquinhos|DEF|Paris Saint-Germain|BRA|86', 'Antonio Rüdiger|DEF|Real Madrid|GER|86',
    'Trent Alexander-Arnold|DEF|Real Madrid|ENG|86', 'Nuno Mendes|DEF|Paris Saint-Germain|POR|86',
    'Josko Gvardiol|DEF|Manchester City|CRO|85', 'Jules Koundé|DEF|Barcelona|FRA|85',
    'Théo Hernandez|DEF|Al Hilal|FRA|85', 'Federico Dimarco|DEF|Inter Milan|ITA|85',
    'Pau Cubarsí|DEF|Barcelona|ESP|84', 'Ronald Araújo|DEF|Barcelona|URU|84',
    'Andrew Robertson|DEF|Liverpool|SCO|84', 'Ibrahima Konaté|DEF|Liverpool|FRA|84',
    'Cristian Romero|DEF|Tottenham Hotspur|ARG|84', 'Dani Carvajal|DEF|Real Madrid|ESP|84',
    'Éder Militão|DEF|Real Madrid|BRA|84', 'Willian Pacho|DEF|Paris Saint-Germain|ECU|84',
    'Alphonso Davies|DEF|Bayern Munich|CAN|83', 'Dayot Upamecano|DEF|Bayern Munich|FRA|83',
    'Jonathan Tah|DEF|Bayern Munich|GER|83', 'Reece James|DEF|Chelsea|ENG|83',
    'Micky van de Ven|DEF|Tottenham Hotspur|NED|83', 'John Stones|DEF|Manchester City|ENG|83',
    'Riccardo Calafiori|DEF|Arsenal|ITA|83', 'Jurriën Timber|DEF|Arsenal|NED|83',
    'Nico Schlotterbeck|DEF|Borussia Dortmund|GER|83', 'Marc Guéhi|DEF|Crystal Palace|ENG|83',
    'Kim Min-jae|DEF|Bayern Munich|KOR|82', 'Matthijs de Ligt|DEF|Manchester United|NED|82',
    'Lisandro Martínez|DEF|Manchester United|ARG|82', 'Pedro Porro|DEF|Tottenham Hotspur|ESP|82',
    'Denzel Dumfries|DEF|Inter Milan|NED|82', 'Gleison Bremer|DEF|Juventus|BRA|82',
    'Alejandro Balde|DEF|Barcelona|ESP|82', 'Robin Le Normand|DEF|Atlético Madrid|ESP|82',
    'José María Giménez|DEF|Atlético Madrid|URU|82', 'Ben White|DEF|Arsenal|ENG|82',
    'Jeremie Frimpong|DEF|Liverpool|NED|82', 'Marc Cucurella|DEF|Chelsea|ESP|81',
    'Dean Huijsen|DEF|Real Madrid|ESP|81', 'Ferland Mendy|DEF|Real Madrid|FRA|81',
    'Nathan Aké|DEF|Manchester City|NED|81', 'Castello Lukeba|DEF|RB Leipzig|FRA|81',
    'Alessandro Buongiorno|DEF|Napoli|ITA|81', 'Levi Colwill|DEF|Chelsea|ENG|80',
    'Fikayo Tomori|DEF|AC Milan|ENG|80', 'Francesco Acerbi|DEF|Inter Milan|ITA|80',
    'Benjamin Pavard|DEF|Marseille|FRA|80', 'David Alaba|DEF|Real Madrid|AUT|80',
    'Sven Botman|DEF|Newcastle United|NED|80', 'Waldemar Anton|DEF|Borussia Dortmund|GER|80',
    'Ezri Konsa|DEF|Aston Villa|ENG|80', 'Pau Torres|DEF|Aston Villa|ESP|80',
    'Diogo Dalot|DEF|Manchester United|POR|80', 'Giovanni Di Lorenzo|DEF|Napoli|ITA|80',
    'Amir Rrahmani|DEF|Napoli|KOS|80', 'Kalidou Koulibaly|DEF|Al Hilal|SEN|79',
    'Nahuel Molina|DEF|Atlético Madrid|ARG|79', 'Kieran Trippier|DEF|Newcastle United|ENG|79',
    'Lucas Hernández|DEF|Paris Saint-Germain|FRA|79', 'Niklas Süle|DEF|Borussia Dortmund|GER|79',
    'Luke Shaw|DEF|Manchester United|ENG|79', 'Milos Kerkez|DEF|Liverpool|HUN|79',
    'Matteo Darmian|DEF|Inter Milan|ITA|78', 'Kyle Walker|DEF|Burnley|ENG|78',
    'Joe Gomez|DEF|Liverpool|ENG|78', 'Wesley Fofana|DEF|Chelsea|FRA|78',
    'Gianluca Mancini|DEF|Roma|ITA|78', 'Álvaro Carreras|DEF|Real Madrid|ESP|78',
    'Pervis Estupiñán|DEF|AC Milan|ECU|77', 'Myles Lewis-Skelly|DEF|Arsenal|ENG|77',
    'Harry Maguire|DEF|Manchester United|ENG|77', 'Lucas Digne|DEF|Aston Villa|FRA|77',
    'Sergio Ramos|DEF|Monterrey|ESP|77', 'Thiago Silva|DEF|Fluminense|BRA|76',
    'Mario Hermoso|DEF|Roma|ESP|76', 'Dan Burn|DEF|Newcastle United|ENG|76',
    'Trevoh Chalobah|DEF|Crystal Palace|ENG|76',
    // Goalkeepers
    'Thibaut Courtois|GK|Real Madrid|BEL|90', 'Alisson Becker|GK|Liverpool|BRA|89',
    'Gianluigi Donnarumma|GK|Manchester City|ITA|88', 'Jan Oblak|GK|Atlético Madrid|SVN|88',
    'Marc-André ter Stegen|GK|Barcelona|GER|87', 'Emiliano Martínez|GK|Aston Villa|ARG|87',
    'Mike Maignan|GK|AC Milan|FRA|87', 'Gregor Kobel|GK|Borussia Dortmund|SUI|86',
    'Manuel Neuer|GK|Bayern Munich|GER|85', 'David Raya|GK|Arsenal|ESP|85',
    'Ederson|GK|Fenerbahçe|BRA|85', 'Yann Sommer|GK|Inter Milan|SUI|84',
    'Unai Simón|GK|Athletic Club|ESP|83', 'Jordan Pickford|GK|Everton|ENG|83',
    'Bono|GK|Al Hilal|MAR|82', 'Mile Svilar|GK|Roma|SRB|82',
    'André Onana|GK|Manchester United|CMR|80', 'Wojciech Szczęsny|GK|Barcelona|POL|80',
    'Keylor Navas|GK|Pumas|CRC|79', 'Hugo Lloris|GK|LAFC|FRA|77'
  ];

  // Opening price by rating. Bids start here and rise in steps of 50.
  function basePrice(r) {
    if (r >= 90) return 2500;
    if (r >= 88) return 2000;
    if (r >= 86) return 1400;
    if (r >= 84) return 900;
    if (r >= 82) return 600;
    if (r >= 80) return 400;
    if (r >= 78) return 250;
    if (r >= 75) return 150;
    return 100;
  }

  const PLAYERS = RAW.map((s, i) => {
    const [name, pos, club, nat, rating] = s.split('|');
    return { id: i, name, pos, club, nat, rating: +rating, base: basePrice(+rating) };
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = PLAYERS;
  else root.PLAYERS = PLAYERS;
})(typeof window !== 'undefined' ? window : globalThis);
