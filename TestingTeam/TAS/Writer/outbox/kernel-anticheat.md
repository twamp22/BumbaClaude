# Kernel-Level Anti-Cheat Is Taking Over PC Gaming. Not Everyone Is Happy About It.

When **Riot Games** launched **Valorant** in 2020, it shipped with something players had not seen at this scale before: an anti-cheat system that loads before Windows finishes booting and runs continuously whether you are playing the game or not. Six years later, that approach has become the industry standard, and the debate over whether that tradeoff is acceptable shows no sign of settling.

## What "Kernel-Level" Actually Means

Modern operating systems divide software access into privilege rings. User-space applications -- your browser, your game client, your Discord -- operate at the outer ring where their ability to touch hardware and memory is limited. The kernel is the innermost ring, sometimes called ring 0, where the operating system itself runs. Code at this level has unrestricted access to the entire machine.

Traditional anti-cheat software ran in user space. Cheat developers adapted quickly, writing their own kernel drivers to hide from detection. The arms race had a predictable outcome: anti-cheat makers moved to the kernel too.

**Vanguard**, Riot's solution used in Valorant and League of Legends, loads its kernel driver (vgk.sys) at system startup. **EasyAntiCheat** (owned by Epic Games) and **BattlEye** take a less aggressive approach, loading their drivers only when a protected game launches and unloading when it closes. EasyAntiCheat protects more than 200 games including **Fortnite**, **Apex Legends**, and **Armored Core VI**. BattlEye is used in roughly 45 titles including **Rainbow Six Siege** and **DayZ**.

## Why Studios Keep Choosing This Approach

The cheat market is not a hobbyist curiosity. According to reporting by Security Brief, the global ecosystem around game cheats -- subscriptions, account boosting services, hardware ID spoofers -- has grown into an estimated $8.5 billion economy. Cheat subscriptions for popular titles like **PUBG**, **Counter-Strike 2**, and Apex Legends run from $10 to $240 per month, according to a University of Birmingham study cited by WN Hub.

For studios running competitive games, cheating is an existential threat to the product. A single high-profile match ruined by an aimbot can drive players away permanently. The business case for aggressive anti-cheat is straightforward: user-space detection was losing, so the industry moved deeper.

Kernel-level systems have a genuine technical advantage. By sitting at the same privilege level as cheating software, they can observe driver loads, scan memory structures, and catch manipulation that would be invisible from user space. Vanguard's boot-time load means any cheat driver attempting to initialize does so under the anti-cheat's watch from the start.

## The Legitimate Concerns Players Are Raising

The problem is that running third-party software at ring 0 requires extending a level of trust that some security professionals consider excessive.

A 2024 academic paper published via ACM Digital Library analyzed the four most widely deployed kernel anti-cheat systems and found that Vanguard and **FACEIT Anti-Cheat** exhibited behavior consistent with rootkits. The trust model is identical to what is used for security-critical software, which means any vulnerability in these components is a local privilege escalation to the deepest level of the machine.

This is not entirely theoretical. Vanguard has caused documented, concrete problems. In September 2024, Valorant pushed an update that caused Vanguard to crash Ethernet connections for a significant number of users, forcing system reboots to restore network access. Technology journalist Tom Warren documented the issue publicly on the same day it occurred. In April 2025, users reported Vanguard interfering with audio drivers, producing system-wide sound issues that only appeared while the game was running. Separate reports of Blue Screen of Death errors linked to Vanguard's kernel driver have appeared on Microsoft's own support forums.

When Vanguard first launched, it blocked a range of third-party tools including fan controllers, temperature monitors, and overclocking software because they used drivers Riot considered unsafe. Users had to choose between their anti-cheat and their hardware monitoring setup.

Linux and dual-boot users have been hit hardest. Vanguard requires Secure Boot to be enabled, a requirement that effectively ends support for Linux. When Riot extended Vanguard to League of Legends in 2024, it cut off the entire Linux player base for that game. Most kernel anti-cheat systems are Windows-only by design, which also blocks Steam Deck players, cloud gaming environments, and anyone running games through Wine or Proton.

## Where This Is Heading

The adoption curve is pointing in one direction. More games are adding kernel-level protection, and the expectation that players will accept it as a condition of online play is now well established. The debate has shifted from whether this approach is reasonable to whether the implementations can be made safer and more transparent.

Some players are pushing back. The Steam curator page "No To Easy Anti-Cheat" exists specifically to catalog and discourage purchases of EAC-protected titles, and the site areweanticheatyet.com tracks which anti-cheat systems block Linux compatibility.

What the industry has not yet done is produce a clear, enforceable standard for how kernel anti-cheat drivers should be developed, audited, or limited in scope. The companies deploying these systems argue their security teams are capable of building them responsibly. Critics argue that arguing from authority is not a substitute for independent verification.

For now, players who want to compete in most major online titles are accepting these systems as a condition of entry, whether they have read the terms carefully or not.

---

*Sources used in reporting this article:*
- [Tom Warren on Vanguard Ethernet crash (X/Twitter, Sept 2024)](https://x.com/tomwarren/status/1834863294730956803)
- [Valorant Anti-Cheat Crashes Ethernet and Sparks System Reboots](https://www.imdb.com/news/ni64825430/) -- FandomWire/IMDb News
- [If It Looks Like a Rootkit: A Critical Examination of Kernel-Level Anti-Cheat Systems](https://dl.acm.org/doi/fullHtml/10.1145/3664476.3670433) -- ACM Digital Library (2024)
- [Video game cheat economy grows into USD $8.5bn giant](https://securitybrief.co.uk/story/video-game-cheat-economy-grows-into-usd-8-5bn-giant) -- Security Brief
- [Study: Sellers of gaming cheats earn up to $73.2 million a year](https://wnhub.io/news/analytics/item-48509) -- WN Hub
- [Games using EasyAntiCheat on Steam](https://steamdb.info/tech/AntiCheat/EasyAntiCheat/) -- SteamDB
- [Are We Anti-Cheat Yet?](https://areweanticheatyet.com/) -- Linux anti-cheat compatibility tracker
- [Consistent BSOD -- Riot Vanguard](https://learn.microsoft.com/en-us/answers/questions/2338864/consistent-bsod-riot-vanguard-how-to-prevent-fix-o) -- Microsoft Q&A
- [Vanguard audio driver issues 2025](https://www.answeroverflow.com/m/1360544787220140245) -- AnswerOverflow
