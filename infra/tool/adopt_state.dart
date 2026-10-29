import 'state_adopt.dart';

Future<void> main() => runStateCommand(
  (source, target, accessToken) => adopt(
    from: source,
    to: CreatableGcsObject(target, accessToken: accessToken),
  ),
);
