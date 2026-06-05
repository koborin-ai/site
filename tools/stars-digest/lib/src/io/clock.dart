/// Today's date in Asia/Tokyo (UTC+9, no DST), as YYYY-MM-DD.
String todayJst() {
  final jst = DateTime.now().toUtc().add(const Duration(hours: 9));
  final m = jst.month.toString().padLeft(2, '0');
  final d = jst.day.toString().padLeft(2, '0');
  return '${jst.year}-$m-$d';
}
