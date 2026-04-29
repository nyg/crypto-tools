import { pgSql } from '@/lib/db'

export default async function getCommunityIndex(req, res) {
   if (!pgSql) {
      return res.status(200).json({ communityIndices: [] })
   }

   const communityIndices = (await pgSql`select * from community_indices`)
      .map(e => ({
         date: e.date.getTime(),
         value: e.value,
      }))

   res.status(200).json({ communityIndices })
}
