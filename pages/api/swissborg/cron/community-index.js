import got from 'got'
import { pgSql } from '@/lib/db'

export default async function fetchAndStoreCommunityIndex(req, res) {
   if (req.method !== 'POST') {
      res.status(405).json({ message: 'Only POST requests allowed' })
      return
   }

   const communityIndex = (await got('https://swissborg.com/page-data/sq/d/3043756154.json')
      .json())
      .data.sbAppFeed.communityIndex

   // this script runs every Wednesday
   const tuesday = new Date()
   tuesday.setDate(tuesday.getDate() - 1)

   await pgSql`INSERT INTO community_indices (date, value) VALUES(${tuesday}, ${communityIndex})`

   res.status(200).json({ status: 'success' })
}
