SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";

--
-- Database: `fsmash`
--

-- --------------------------------------------------------

--
-- Table structure for table `administrators`
--

CREATE TABLE `administrators` (
  `administratorID` int(11) NOT NULL auto_increment,
  `administratorUserID` int(11) NOT NULL,
  `administratorTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`administratorID`),
  UNIQUE KEY `userID` (`administratorUserID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bannedIPs`
--

CREATE TABLE `bannedIPs` (
  `bannedIPID` int(11) NOT NULL auto_increment,
  `minIPAddress` bigint(20) unsigned NOT NULL,
  `maxIPAddress` bigint(20) unsigned NOT NULL,
  `modUserID` int(11) NOT NULL,
  `reason` text collate utf8_unicode_ci NOT NULL,
  `bannedTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`bannedIPID`),
  KEY `minIPAddress` (`minIPAddress`),
  KEY `maxIPAddress` (`maxIPAddress`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bannedSessions`
--

CREATE TABLE `bannedSessions` (
  `bannedSessionID` int(11) NOT NULL auto_increment,
  `sessionID` int(11) NOT NULL,
  `modUserID` int(11) default NULL,
  `dependentSessionID` int(11) default NULL,
  `reason` text collate utf8_unicode_ci,
  `bannedTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`bannedSessionID`),
  UNIQUE KEY `sessionID` (`sessionID`),
  KEY `modUserID` (`modUserID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `censoredMessages`
--

CREATE TABLE `censoredMessages` (
  `censoredMessageID` int(11) NOT NULL auto_increment,
  `modUserID` int(11) NOT NULL,
  `channelID` int(11) NOT NULL,
  `censorText` text collate utf8_unicode_ci NOT NULL,
  `replacementText` text collate utf8_unicode_ci NOT NULL,
  `censorTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`censoredMessageID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `channelAncestors`
--

CREATE TABLE `channelAncestors` (
  `channelAncestorID` int(11) NOT NULL auto_increment,
  `channelID` int(11) NOT NULL,
  `ancestorID` int(11) NOT NULL,
  PRIMARY KEY  (`channelAncestorID`),
  UNIQUE KEY `channelID` (`channelID`,`ancestorID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `channelMembers`
--

CREATE TABLE `channelMembers` (
  `channelMemberID` int(11) NOT NULL auto_increment,
  `channelID` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `isCreator` tinyint(4) NOT NULL default '0',
  `invitedByUserID` int(11) default NULL,
  `joinTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`channelMemberID`),
  UNIQUE KEY `channelID` (`channelID`,`userID`),
  KEY `invitedByUserID` (`invitedByUserID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `channelModerators`
--

CREATE TABLE `channelModerators` (
  `channelModeratorID` int(11) NOT NULL auto_increment,
  `channelID` int(11) NOT NULL,
  `moderatorUserID` int(11) NOT NULL,
  `moderatorTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`channelModeratorID`),
  UNIQUE KEY `channelID` (`channelID`,`moderatorUserID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `channels`
--

CREATE TABLE `channels` (
  `channelID` int(11) NOT NULL auto_increment,
  `topic` varchar(255) collate utf8_unicode_ci default NULL,
  `parentID` int(11) default NULL,
  `allowsGameChannels` tinyint(4) NOT NULL default '1',
  `historyJSON` text collate utf8_unicode_ci,
  `creationTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`channelID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `donationAttempts`
--

CREATE TABLE `donationAttempts` (
  `donationAttemptID` int(11) NOT NULL auto_increment,
  `query` text collate utf8_unicode_ci NOT NULL,
  `attemptTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`donationAttemptID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `donations`
--

CREATE TABLE `donations` (
  `donationID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `payerID` varchar(13) collate utf8_unicode_ci NOT NULL,
  `transactionID` varchar(19) collate utf8_unicode_ci default NULL,
  `pennies` int(11) NOT NULL default '0',
  `startTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `expireTime` timestamp NOT NULL default '0000-00-00 00:00:00',
  PRIMARY KEY  (`donationID`),
  UNIQUE KEY `transactionID` (`transactionID`),
  KEY `expireTime` (`expireTime`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `games`
--

CREATE TABLE `games` (
  `gameID` int(11) NOT NULL auto_increment,
  `channelID` int(11) NOT NULL,
  `matchTypeID` int(11) NOT NULL default '0',
  `ruleID` int(11) NOT NULL default '0',
  PRIMARY KEY  (`gameID`),
  UNIQUE KEY `channelID` (`channelID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `httpRequests`
--

CREATE TABLE `httpRequests` (
  `requestID` int(11) NOT NULL auto_increment,
  `ipAddress` bigint(20) unsigned default NULL,
  `filename` varchar(255) collate utf8_unicode_ci NOT NULL,
  `header` text collate utf8_unicode_ci,
  `referer` text collate utf8_unicode_ci,
  `userAgent` text collate utf8_unicode_ci,
  `requestTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`requestID`),
  KEY `ipAddress` (`ipAddress`),
  KEY `filename` (`filename`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ignores`
--

CREATE TABLE `ignores` (
  `ignoreID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `ignoredUserID` int(11) NOT NULL,
  `ignoreTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`ignoreID`),
  UNIQUE KEY `userID` (`userID`,`ignoredUserID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `matchTypes`
--

CREATE TABLE `matchTypes` (
  `matchTypeID` int(11) NOT NULL auto_increment,
  `label` varchar(255) collate utf8_unicode_ci NOT NULL,
  `hasTeams` tinyint(4) NOT NULL,
  `playerCount` int(11) NOT NULL,
  `sortOrder` int(11) NOT NULL,
  PRIMARY KEY  (`matchTypeID`),
  UNIQUE KEY `sortOrder` (`sortOrder`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `profiles`
--

CREATE TABLE `profiles` (
  `userProfileID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `brawlName` varchar(20) collate utf8_unicode_ci NOT NULL default '',
  `friendCode` varchar(12) collate utf8_unicode_ci NOT NULL default '',
  `bio` text collate utf8_unicode_ci NOT NULL,
  `color` varchar(6) collate utf8_unicode_ci default NULL,
  PRIMARY KEY  (`userProfileID`),
  UNIQUE KEY `userID` (`userID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `publicChannels`
--

CREATE TABLE `publicChannels` (
  `publicChannelID` int(11) NOT NULL auto_increment,
  `channelID` int(11) NOT NULL,
  `descriptionHTML` text collate utf8_unicode_ci NOT NULL,
  `sortOrder` int(11) NOT NULL,
  PRIMARY KEY  (`publicChannelID`),
  UNIQUE KEY `channelID` (`channelID`),
  UNIQUE KEY `sortOrder` (`sortOrder`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rankings`
--

CREATE TABLE `rankings` (
  `rankingID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `directPoints` int(11) NOT NULL,
  `indirectPoints` int(11) NOT NULL,
  `totalPoints` int(11) NOT NULL,
  PRIMARY KEY  (`rankingID`),
  UNIQUE KEY `userID` (`userID`),
  KEY `totalPoints` (`totalPoints`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ratings`
--

CREATE TABLE `ratings` (
  `ratingID` int(11) NOT NULL auto_increment,
  `fromUserID` int(11) NOT NULL,
  `toUserID` int(11) NOT NULL,
  `ratingType` int(11) NOT NULL,
  `ratingTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `isContradicted` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`ratingID`),
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
  `reportMessageID` int(11) NOT NULL auto_increment,
  `reportID` int(11) NOT NULL,
  `messageUserID` int(11) NOT NULL,
  `messageText` text collate utf8_unicode_ci NOT NULL,
  `messageTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`reportMessageID`),
  KEY `reportID` (`reportID`),
  KEY `messageUserID` (`messageUserID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reports`
--

CREATE TABLE `reports` (
  `reportID` int(11) NOT NULL auto_increment,
  `channelID` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `isResolved` tinyint(4) NOT NULL default '0',
  `reportTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`reportID`),
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
  `ruleID` int(11) NOT NULL auto_increment,
  `label` varchar(255) collate utf8_unicode_ci NOT NULL,
  `sortOrder` int(11) NOT NULL,
  PRIMARY KEY  (`ruleID`),
  UNIQUE KEY `sortOrder` (`sortOrder`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `sessionID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `ipAddress` bigint(20) unsigned default NULL,
  `creationTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`sessionID`),
  KEY `userID` (`userID`),
  KEY `ipAddress` (`ipAddress`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `settingsID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `styleID` int(11) NOT NULL default '1',
  `soundsetID` int(11) NOT NULL default '2',
  PRIMARY KEY  (`settingsID`),
  UNIQUE KEY `userID` (`userID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `soundsets`
--

CREATE TABLE `soundsets` (
  `soundsetID` int(11) NOT NULL auto_increment,
  `label` varchar(255) collate utf8_unicode_ci NOT NULL,
  `path` varchar(255) collate utf8_unicode_ci default NULL,
  `challenge` varchar(255) collate utf8_unicode_ci default NULL,
  `join` varchar(255) collate utf8_unicode_ci default NULL,
  `leave` varchar(255) collate utf8_unicode_ci default NULL,
  `message` varchar(255) collate utf8_unicode_ci default NULL,
  `sortOrder` int(11) NOT NULL,
  PRIMARY KEY  (`soundsetID`),
  UNIQUE KEY `sortOrder` (`sortOrder`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tokens`
--

CREATE TABLE `tokens` (
  `tokenID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `token` varchar(50) collate utf8_unicode_ci NOT NULL,
  PRIMARY KEY  (`tokenID`),
  UNIQUE KEY `userID` (`userID`),
  KEY `token` (`token`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `userID` int(11) NOT NULL auto_increment,
  `userName` varchar(255) collate utf8_unicode_ci NOT NULL,
  `passHash` varchar(40) collate utf8_unicode_ci default NULL,
  `passHash2` varchar(60) collate utf8_unicode_ci default NULL,
  `registerTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`userID`),
  UNIQUE KEY `name` (`userName`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `videos`
--

CREATE TABLE `videos` (
  `videoID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `youtubeID` varchar(11) collate utf8_unicode_ci NOT NULL,
  `submitTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `deleteTime` timestamp NULL default NULL,
  PRIMARY KEY  (`videoID`),
  UNIQUE KEY `youtubeID` (`youtubeID`),
  KEY `submitTime` (`submitTime`),
  KEY `deleteTime` (`deleteTime`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `whitelist`
--

CREATE TABLE `whitelist` (
  `whitelistID` int(11) NOT NULL auto_increment,
  `userID` int(11) NOT NULL,
  `modID` int(11) default NULL,
  `whitelistTime` timestamp NOT NULL default CURRENT_TIMESTAMP,
  PRIMARY KEY  (`whitelistID`),
  UNIQUE KEY `userID` (`userID`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
