-- phpMyAdmin SQL Dump
-- version 4.3.8deb0.1
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: Apr 09, 2015 at 05:56 PM
-- Server version: 5.5.42-MariaDB-1~precise-log
-- PHP Version: 5.5.23-1+deb.sury.org~precise+2

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Database: `flame`
--

-- --------------------------------------------------------

--
-- Table structure for table `Events`
--

CREATE TABLE IF NOT EXISTS `Events` (
  `id` int(11) NOT NULL DEFAULT '0',
  `Session` varchar(256) NOT NULL,
  `Event` varchar(256) NOT NULL,
  `Data` varchar(256) NOT NULL,
  `Category` varchar(256) NOT NULL,
  `Request_Protocol` varchar(8) NOT NULL,
  `Request_Domain` varchar(256) NOT NULL,
  `Request_Path` varchar(256) NOT NULL,
  `Request_Query` varchar(256) NOT NULL,
  `Request_Fragment` varchar(256) NOT NULL,
  `Referer_Protocol` varchar(256) NOT NULL,
  `Referer_Domain` varchar(256) NOT NULL,
  `Referer_Path` varchar(256) NOT NULL,
  `Referer_Query` varchar(256) NOT NULL,
  `Referer_Fragment` varchar(256) NOT NULL,
  `Browser` varchar(64) NOT NULL,
  `Browser_Version` varchar(256) NOT NULL,
  `Browser_Engine` varchar(256) NOT NULL,
  `OperatingSystem_Name` varchar(128) NOT NULL,
  `OperatingSystem_Family` varchar(64) NOT NULL,
  `OperatingSystem_Architecture` varchar(16) NOT NULL,
  `Mobile` varchar(256) NOT NULL,
  `Search_Engine` varchar(256) NOT NULL,
  `Search_Query` varchar(256) NOT NULL,
  `Visits` int(11) NOT NULL,
  `Screen_Orientation_Type` varchar(256) NOT NULL,
  `Screen_Orientation_Angle` int(11) NOT NULL,
  `Screen_Depth` int(11) NOT NULL,
  `Screen_Height` int(11) NOT NULL,
  `Screen_Width` int(11) NOT NULL,
  `Viewport_Height` int(11) NOT NULL,
  `Viewport_Width` int(11) NOT NULL,
  `Timezone` varchar(8) NOT NULL,
  `Timezone_DST` tinyint(1) NOT NULL,
  `Plugins_Flash` tinyint(1) NOT NULL,
  `Plugins_Java` tinyint(1) NOT NULL,
  `Plugins_Quicktime` tinyint(1) NOT NULL,
  `Plugins_Silverlight` tinyint(1) NOT NULL,
  `Language` varchar(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
