import 'state_adopt.dart';

Future<void> main() => runStateCommand(
  (source, target, accessToken) => requireAdopted(
    from: source,
    target: GcsObject(target, accessToken: accessToken),
  ),
);
