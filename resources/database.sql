SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";

--
-- Database: `fsmash`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `adminID` int(11) NOT NULL AUTO_INCREMENT,
  `userID` int(11) NOT NULL,
  PRIMARY KEY (`adminID`),
  UNIQUE KEY `userID` (`userID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bannedIPs`
--

CREATE TABLE `bannedIPs` (
  `bannedIPID` int(11) NOT NULL AUTO_INCREMENT,
  `minIPAddress` int(11) NOT NULL,
  `maxIPAddress` int(11) NOT NULL,
  `modUserID` int(11) NOT NULL,
  `reason` text COLLATE utf8_unicode_ci NOT NULL,
  `bannedTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`bannedIPID`),
  KEY `minIPAddress` (`minIPAddress`),
  KEY `maxIPAddress` (`maxIPAddress`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bannedSessions`
--

CREATE TABLE `bannedSessions` (
  `bannedSessionID` int(11) NOT NULL AUTO_INCREMENT,
  `sessionID` int(11) NOT NULL,
  `modUserID` int(11) DEFAULT NULL,
  `dependentSessionID` int(11) DEFAULT NULL,
  `reason` text COLLATE utf8_unicode_ci,
  `bannedTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`bannedSessionID`),
  UNIQUE KEY `sessionID` (`sessionID`),
  KEY `modUserID` (`modUserID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `channelMembers`
--

CREATE TABLE `channelMembers` (
  `channelMemberID` int(11) NOT NULL AUTO_INCREMENT,
  `channelID` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `isCreator` tinyint(4) NOT NULL DEFAULT '0',
  `joinTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`channelMemberID`),
  UNIQUE KEY `channelID` (`channelID`,`userID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `channels`
--

CREATE TABLE `channels` (
  `channelID` int(11) NOT NULL AUTO_INCREMENT,
  `topic` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `parentID` int(11) DEFAULT NULL,
  `allowsGameChannels` tinyint(4) NOT NULL DEFAULT '1',
  `creationTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`channelID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fips_regions`
--

CREATE TABLE `fips_regions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `country_code` varchar(2) NOT NULL,
  `code` varchar(2) NOT NULL,
  `name` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `code2country` (`country_code`,`code`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `games`
--

CREATE TABLE `games` (
  `gameID` int(11) NOT NULL AUTO_INCREMENT,
  `channelID` int(11) NOT NULL,
  `matchTypeID` int(11) NOT NULL DEFAULT '0',
  `ruleID` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`gameID`),
  UNIQUE KEY `channelID` (`channelID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ip_group_city`
--

CREATE TABLE `ip_group_city` (
  `ip_start` bigint(20) NOT NULL,
  `location` int(11) NOT NULL,
  UNIQUE KEY `ip_start` (`ip_start`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `ip_group_country`
--

CREATE TABLE `ip_group_country` (
  `ip_start` bigint(20) NOT NULL,
  `ip_cidr` varchar(20) NOT NULL,
  `country_code` varchar(2) NOT NULL,
  UNIQUE KEY `ip_start` (`ip_start`),
  KEY `country` (`country_code`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `iso3166_countries`
--

CREATE TABLE `iso3166_countries` (
  `code` varchar(2) NOT NULL,
  `name` char(64) NOT NULL,
  UNIQUE KEY `code` (`code`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `locations`
--

CREATE TABLE `locations` (
  `id` int(11) NOT NULL,
  `country_code` varchar(2) NOT NULL,
  `region_code` varchar(2) NOT NULL,
  `city` varchar(64) NOT NULL,
  `zipcode` varchar(8) NOT NULL,
  `latitude` float NOT NULL,
  `longitude` float NOT NULL,
  `metrocode` varchar(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `matchTypes`
--

CREATE TABLE `matchTypes` (
  `matchTypeID` int(11) NOT NULL AUTO_INCREMENT,
  `label` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `hasTeams` tinyint(4) NOT NULL,
  `playerCount` int(11) NOT NULL,
  `sortOrder` int(11) NOT NULL,
  PRIMARY KEY (`matchTypeID`),
  UNIQUE KEY `sortOrder` (`sortOrder`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `profiles`
--

CREATE TABLE `profiles` (
  `userProfileID` int(11) NOT NULL AUTO_INCREMENT,
  `userID` int(11) NOT NULL,
  `brawlName` varchar(20) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `friendCode` varchar(12) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `bio` text COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`userProfileID`),
  UNIQUE KEY `userID` (`userID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `publicChannels`
--

CREATE TABLE `publicChannels` (
  `publicChannelID` int(11) NOT NULL AUTO_INCREMENT,
  `channelID` int(11) NOT NULL,
  `descriptionHTML` text COLLATE utf8_unicode_ci NOT NULL,
  `sortOrder` int(11) NOT NULL,
  PRIMARY KEY (`publicChannelID`),
  UNIQUE KEY `channelID` (`channelID`),
  UNIQUE KEY `sortOrder` (`sortOrder`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rankings`
--

CREATE TABLE `rankings` (
  `rankingID` int(11) NOT NULL AUTO_INCREMENT,
  `userID` int(11) NOT NULL,
  `directPoints` int(11) NOT NULL,
  `indirectPoints` int(11) NOT NULL,
  `totalPoints` int(11) NOT NULL,
  PRIMARY KEY (`rankingID`),
  UNIQUE KEY `userID` (`userID`),
  KEY `totalPoints` (`totalPoints`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ratings`
--

CREATE TABLE `ratings` (
  `ratingID` int(11) NOT NULL AUTO_INCREMENT,
  `fromUserID` int(11) NOT NULL,
  `toUserID` int(11) NOT NULL,
  `ratingType` int(11) NOT NULL,
  `ratingTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `isContradicted` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ratingID`),
  UNIQUE KEY `fromUserID` (`fromUserID`,`toUserID`),
  KEY `ratingType` (`ratingType`),
  KEY `ratingTime` (`ratingTime`),
  KEY `isContradicted` (`isContradicted`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reportMessages`
--

CREATE TABLE `reportMessages` (
  `reportMessageID` int(11) NOT NULL AUTO_INCREMENT,
  `reportID` int(11) NOT NULL,
  `messageUserID` int(11) NOT NULL,
  `messageText` text COLLATE utf8_unicode_ci NOT NULL,
  `messageTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reportMessageID`),
  KEY `reportID` (`reportID`),
  KEY `messageUserID` (`messageUserID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reports`
--

CREATE TABLE `reports` (
  `reportID` int(11) NOT NULL AUTO_INCREMENT,
  `channelID` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `isResolved` tinyint(4) NOT NULL DEFAULT '0',
  `reportTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reportID`),
  KEY `userID` (`userID`),
  KEY `channelID` (`channelID`),
  KEY `isResolved` (`isResolved`),
  KEY `reportTime` (`reportTime`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rules`
--

CREATE TABLE `rules` (
  `ruleID` int(11) NOT NULL AUTO_INCREMENT,
  `label` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `sortOrder` int(11) NOT NULL,
  PRIMARY KEY (`ruleID`),
  UNIQUE KEY `sortOrder` (`sortOrder`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `sessionID` int(11) NOT NULL AUTO_INCREMENT,
  `userID` int(11) NOT NULL,
  `ipAddress` int(11) DEFAULT NULL,
  `creationTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sessionID`),
  KEY `userID` (`userID`),
  KEY `ipAddress` (`ipAddress`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `settingsID` int(11) NOT NULL AUTO_INCREMENT,
  `userID` int(11) NOT NULL,
  `styleID` int(11) NOT NULL DEFAULT '1',
  `soundsetID` int(11) NOT NULL DEFAULT '2',
  PRIMARY KEY (`settingsID`),
  UNIQUE KEY `userID` (`userID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `signinAttempts`
--

CREATE TABLE `signinAttempts` (
  `signinAttemptID` int(11) NOT NULL AUTO_INCREMENT,
  `ipAddress` int(11) DEFAULT NULL,
  `userName` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `signinTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`signinAttemptID`),
  KEY `signinTime` (`signinTime`),
  KEY `ipAddress` (`ipAddress`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `soundsets`
--

CREATE TABLE `soundsets` (
  `soundsetID` int(11) NOT NULL AUTO_INCREMENT,
  `label` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `path` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `challenge` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `join` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `leave` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `message` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `sortOrder` int(11) NOT NULL,
  PRIMARY KEY (`soundsetID`),
  UNIQUE KEY `sortOrder` (`sortOrder`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tokens`
--

CREATE TABLE `tokens` (
  `tokenID` int(11) NOT NULL AUTO_INCREMENT,
  `userID` int(11) NOT NULL,
  `token` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`tokenID`),
  UNIQUE KEY `userID` (`userID`),
  KEY `token` (`token`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `userID` int(11) NOT NULL AUTO_INCREMENT,
  `userName` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `passHash` varchar(40) COLLATE utf8_unicode_ci DEFAULT NULL,
  `passHash2` varchar(60) COLLATE utf8_unicode_ci DEFAULT NULL,
  `registerTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`userID`),
  UNIQUE KEY `name` (`userName`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `videos`
--

CREATE TABLE `videos` (
  `videoID` int(11) NOT NULL AUTO_INCREMENT,
  `userID` int(11) NOT NULL,
  `youtubeID` varchar(11) COLLATE utf8_unicode_ci NOT NULL,
  `submitTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`videoID`),
  UNIQUE KEY `youtubeID` (`youtubeID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `whitelist`
--

CREATE TABLE `whitelist` (
  `whitelistID` int(11) NOT NULL AUTO_INCREMENT,
  `userID` int(11) NOT NULL,
  `modID` int(11) DEFAULT NULL,
  `whitelistTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`whitelistID`),
  UNIQUE KEY `userID` (`userID`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
